// The narrator: the warm voice that reads the fable aloud.
//
// Two implementations behind one interface:
//  - LiveKitNarrator  — connects to a LiveKit room where the storyteller agent
//    speaks each line in a warm Cartesia voice, and (at the fork) listens so the
//    child can SPEAK their choice. This is the real, human-like voice.
//  - WebSpeechNarrator — the browser's speechSynthesis. A silent-never FALLBACK
//    used if LiveKit isn't configured or the agent doesn't join in time, so the
//    story always has a voice.
//
// App picks LiveKit when available, else Web Speech. Story.tsx talks only to the
// Narrator interface.

import { speak as webSpeak, cancelNarration, primeVoices } from "./narration";

export interface ChoiceListen {
  id: string;
  label: string;
  words?: string[];
}

export interface Narrator {
  kind: "livekit" | "webspeech";
  /** Speak a passage; resolves when it finishes (or a safety timeout fires). */
  narrate(text: string): Promise<void>;
  /** Stop any current speech immediately. */
  stop(): void;
  /** At the fork: let the child speak / converse about these choices. */
  setChoices(choices: ChoiceListen[] | null): void;
  /** The child TAPPED a choice — have the storyteller acknowledge it aloud. */
  acknowledge(label: string): Promise<void>;
  /** Register the spoken-choice callback (fires when the child SAYS a choice). */
  onChoice(cb: (id: string) => void): void;
  /** Register the "is the voice speaking right now" callback (drives the glow). */
  onSpeaking(cb: (on: boolean) => void): void;
  /** Tear down (leave the room / cancel speech). */
  disconnect(): void;
}

// ---------------------------------------------------------------------------
// Web Speech fallback
// ---------------------------------------------------------------------------

class WebSpeechNarrator implements Narrator {
  kind = "webspeech" as const;
  private speakingCb: (on: boolean) => void = () => {};
  private handle: { cancel: () => void } | null = null;

  constructor() {
    primeVoices();
  }

  narrate(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.handle?.cancel();
      this.speakingCb(true);
      this.handle = webSpeak(text, {
        onStart: () => this.speakingCb(true),
        onEnd: () => {
          this.speakingCb(false);
          resolve();
        },
      });
    });
  }
  stop() {
    this.handle?.cancel();
    cancelNarration();
    this.speakingCb(false);
  }
  setChoices() {
    /* no spoken choices on Web Speech */
  }
  acknowledge(label: string): Promise<void> {
    return this.narrate(`You chose to ${label.toLowerCase()}. Let's see what happens.`);
  }
  onChoice() {
    /* never fires */
  }
  onSpeaking(cb: (on: boolean) => void) {
    this.speakingCb = cb;
  }
  disconnect() {
    this.stop();
  }
}

// ---------------------------------------------------------------------------
// LiveKit storyteller
// ---------------------------------------------------------------------------

interface TokenResponse {
  available: boolean;
  serverUrl?: string;
  roomName?: string;
  participantToken?: string;
}

class LiveKitNarrator implements Narrator {
  kind = "livekit" as const;
  private room: import("livekit-client").Room | null = null;
  private speakingCb: (on: boolean) => void = () => {};
  private choiceCb: (id: string) => void = () => {};
  private pending = new Map<string, () => void>();
  private seq = 0;
  private audioEls: HTMLAudioElement[] = [];
  private micRequested = false;
  private childName = "little one";
  private ackResolve: (() => void) | null = null;

  /** Connect + wait for the agent to be ready. Throws if it can't within timeout. */
  async connect(req: { situation: string; child_name: string; age_band: string }): Promise<void> {
    this.childName = req.child_name || "little one";
    const res = await fetch("/api/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const data = (await res.json()) as TokenResponse;
    if (!data.available || !data.serverUrl || !data.participantToken) {
      throw new Error("livekit_unavailable");
    }

    const { Room, RoomEvent, Track } = await import("livekit-client");
    const room = new Room({ adaptiveStream: true, dynacast: true });
    this.room = room;

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach() as HTMLAudioElement;
        el.autoplay = true;
        (el as HTMLAudioElement).setAttribute("playsinline", "true");
        document.body.appendChild(el);
        this.audioEls.push(el);
        el.play().catch(() => {});
      }
    });

    room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      this.handleAgentMsg(msg);
    });

    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("agent_timeout")), 9000);
      this.pending.set("__ready__", () => {
        clearTimeout(timer);
        resolve();
      });
    });

    await room.connect(data.serverUrl, data.participantToken);
    await ready; // wait for the agent's {"t":"ready"}
  }

  private handleAgentMsg(msg: Record<string, unknown>) {
    switch (msg.t) {
      case "ready": {
        this.pending.get("__ready__")?.();
        this.pending.delete("__ready__");
        break;
      }
      case "speaking":
        this.speakingCb(Boolean(msg.on));
        break;
      case "say_done": {
        const id = String(msg.id);
        this.pending.get(id)?.();
        this.pending.delete(id);
        break;
      }
      case "choice":
        if (msg.id) this.choiceCb(String(msg.id));
        break;
      case "ack_done":
        this.ackResolve?.();
        this.ackResolve = null;
        break;
      default:
        break;
    }
  }

  private send(msg: Record<string, unknown>) {
    if (!this.room) return;
    Promise.resolve(
      this.room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(msg)),
        { reliable: true },
      ),
    ).catch(() => {
      /* ignore — the safety timeout in narrate() keeps the story moving */
    });
  }

  narrate(text: string): Promise<void> {
    const id = String(++this.seq);
    return new Promise((resolve) => {
      // safety timeout so the story never hangs if a say_done is lost
      const words = text.split(/\s+/).length;
      const timeoutMs = Math.min(30000, Math.max(7000, words * 600));
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve();
      }, timeoutMs);
      this.pending.set(id, () => {
        clearTimeout(timer);
        resolve();
      });
      this.send({ t: "say", id, text });
    });
  }
  stop() {
    this.send({ t: "stop" });
    this.speakingCb(false);
  }
  setChoices(choices: ChoiceListen[] | null) {
    if (choices && choices.length) {
      // lazily ask for the mic only when the child can actually speak a choice —
      // no jarring permission prompt at the start. Tapping always works.
      if (!this.micRequested && this.room) {
        this.micRequested = true;
        this.room.localParticipant.setMicrophoneEnabled(true).catch(() => {});
      }
      this.send({ t: "listen", choices, child_name: this.childName });
    } else {
      // leaving the fork — stop listening and mute the mic again
      this.send({ t: "unlisten" });
      this.room?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
  }

  acknowledge(label: string): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.ackResolve = null;
        resolve();
      }, 9000);
      this.ackResolve = () => {
        clearTimeout(timer);
        resolve();
      };
      this.send({ t: "chose", id: "", label });
    });
  }
  onChoice(cb: (id: string) => void) {
    this.choiceCb = cb;
  }
  onSpeaking(cb: (on: boolean) => void) {
    this.speakingCb = cb;
  }
  disconnect() {
    this.stop();
    for (const el of this.audioEls) {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    }
    this.audioEls = [];
    try {
      this.room?.disconnect();
    } catch {
      /* ignore */
    }
    this.room = null;
  }
}

// ---------------------------------------------------------------------------
// Factory: try LiveKit, fall back to Web Speech. Never throws.
// ---------------------------------------------------------------------------

export async function createNarrator(req: {
  situation: string;
  child_name: string;
  age_band: string;
}): Promise<Narrator> {
  try {
    const lk = new LiveKitNarrator();
    await lk.connect(req);
    return lk;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.info("[narrator] LiveKit unavailable, using Web Speech:", e instanceof Error ? e.message : e);
    return new WebSpeechNarrator();
  }
}
