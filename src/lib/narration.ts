// Narration is the soul of the app — the child may not read, so the audio
// carries the story. Browser Web Speech API only (no external TTS).
//
// Rules (tender-ui skill):
//  - warmest available voice, rate ~0.9
//  - first utterance must follow a user gesture (autoplay is blocked otherwise)
//  - a short pause between sentences, a longer one between scenes (we narrate
//    one scene at a time, so the caller controls scene gaps)

const RATE = 0.9;
const PITCH = 1.0;

// Voices preferred for warmth, in priority order (substring match, case-insensitive).
const PREFERRED = [
  "samantha",
  "ava",
  "allison",
  "serena",
  "moira",
  "karen",
  "tessa",
  "google uk english female",
  "google us english",
  "fiona",
  "victoria",
  "female",
];

let cachedVoice: SpeechSynthesisVoice | null = null;

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function chooseVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  for (const want of PREFERRED) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(want));
    if (hit) return hit;
  }
  return pool[0] || voices[0];
}

/** Warm voices may load async — call once early (e.g. on the start tap). */
export function primeVoices(): void {
  if (!speechSupported()) return;
  cachedVoice = chooseVoice();
  if (!cachedVoice) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = chooseVoice();
    };
  }
}

export function cancelNarration(): void {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export interface SpeakHandle {
  cancel: () => void;
}

/**
 * Speak a passage. Sentences are split so we can add gentle pauses between them.
 * onEnd fires once the whole passage finishes (or immediately if unsupported).
 */
export function speak(
  text: string,
  opts: { onStart?: () => void; onEnd?: () => void; onBoundary?: () => void } = {},
): SpeakHandle {
  if (!speechSupported() || !text.trim()) {
    opts.onStart?.();
    // let the UI settle, then resolve
    const t = setTimeout(() => opts.onEnd?.(), 1200);
    return { cancel: () => clearTimeout(t) };
  }

  cancelNarration();
  if (!cachedVoice) cachedVoice = chooseVoice();

  // split into sentences for softer cadence
  const sentences = text
    .replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]*/g) || [text];

  let i = 0;
  let cancelled = false;
  let started = false;

  const speakNext = () => {
    if (cancelled) return;
    if (i >= sentences.length) {
      opts.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(sentences[i].trim());
    if (cachedVoice) u.voice = cachedVoice;
    u.rate = RATE;
    u.pitch = PITCH;
    u.lang = cachedVoice?.lang || "en-US";
    u.onstart = () => {
      if (!started) {
        started = true;
        opts.onStart?.();
      }
    };
    u.onend = () => {
      i += 1;
      if (cancelled) return;
      // short pause between sentences
      setTimeout(speakNext, 260);
    };
    u.onerror = () => {
      i += 1;
      if (!cancelled) setTimeout(speakNext, 120);
    };
    try {
      window.speechSynthesis.speak(u);
    } catch {
      opts.onEnd?.();
    }
  };

  speakNext();

  return {
    cancel: () => {
      cancelled = true;
      cancelNarration();
    },
  };
}
