import { useEffect, useRef, useState } from "react";
import type { AgeBand, FableRequest, FableResponse } from "./types";
import { requestFable } from "./lib/api";
import { getDemoByKey } from "./lib/demos";
import { primeVoices } from "./lib/narration";
import { createNarrator, type Narrator } from "./lib/narrator";
import { startAmbient, setAmbientMuted, stopAmbient } from "./lib/ambient";
import GrownupAsk from "./ui/GrownupAsk";
import Story from "./ui/Story";
import StudioPanel from "./ui/StudioPanel";

type Phase = "ask" | "conjure" | "story";

const MIN_CONJURE_MS = 1800; // the wait should feel like magic, not lag

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Drifting stars while the tale is woven — never a spinner or progress bar. */
function Conjuring({ name }: { name: string }) {
  const stars = Array.from({ length: 16 });
  return (
    <div className="stack center grow fade-in" style={{ justifyContent: "center", gap: 28, position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {stars.map((_, i) => {
          const left = (i * 61) % 100;
          const delaySec = (i % 8) * 0.5;
          const dur = 4 + (i % 5);
          const size = 2 + (i % 3);
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: `${left}%`,
                bottom: `-10px`,
                width: size,
                height: size,
                borderRadius: 999,
                background: "var(--stars)",
                animation: `drift ${dur}s linear ${delaySec}s infinite`,
              }}
            />
          );
        })}
      </div>
      <div style={{ fontSize: 52, animation: "twinkle 2.4s ease-in-out infinite" }} aria-hidden>
        ✦
      </div>
      <p className="narration center" style={{ maxWidth: 320 }}>
        Weaving a tale just for {name}…
      </p>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("ask");
  const [response, setResponse] = useState<FableResponse | null>(null);
  const [narrator, setNarrator] = useState<Narrator | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [showStudio, setShowStudio] = useState(false);
  const [musicOff, setMusicOff] = useState(false);
  const lastReqName = useRef("Friend");

  // keep the page from scrolling on small screens between phases
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // stop the ambient score when the app unmounts
  useEffect(() => () => stopAmbient(), []);

  function toggleMusic() {
    setMusicOff((off) => {
      const next = !off;
      setAmbientMuted(next);
      return next;
    });
  }

  function disposeNarrator() {
    setNarrator((n) => {
      n?.disconnect();
      return null;
    });
  }

  async function startStory(req: FableRequest) {
    setNotice(undefined);
    lastReqName.current = req.child_name || "Friend";
    primeVoices(); // warm the fallback voices on the user's start gesture
    startAmbient(); // begin the gentle score (this tap is the required gesture)
    setPhase("conjure");
    // Generate the fable AND wake the storyteller voice in parallel; the
    // conjuring animation covers both. createNarrator never throws — it falls
    // back to Web Speech so there is always a voice.
    const [res, narr] = (await Promise.all([
      requestFable(req),
      createNarrator(req),
      delay(MIN_CONJURE_MS),
    ])) as [FableResponse, Narrator, void];

    if (res.blocked) {
      narr.disconnect();
      setNotice(`Let's pick something for ${req.child_name || "tonight"}.`);
      setPhase("ask");
      return;
    }
    setNarrator(narr);
    setResponse(res);
    setPhase("story");
  }

  async function startInstantDemo(key: string, childName: string, ageBand: AgeBand) {
    setNotice(undefined);
    lastReqName.current = childName || "Friend";
    primeVoices();
    setPhase("conjure");
    const [, narr] = (await Promise.all([
      delay(MIN_CONJURE_MS),
      createNarrator({ situation: key, child_name: childName, age_band: ageBand }),
    ])) as [void, Narrator];
    setNarrator(narr);
    setResponse({ fable: getDemoByKey(key, childName, ageBand), source: "demo" });
    setPhase("story");
  }

  function restart() {
    disposeNarrator();
    setResponse(null);
    setNotice(undefined);
    setPhase("ask");
  }

  return (
    <div className="app-shell">
      {/* music toggle (top-left) */}
      <button
        aria-label={musicOff ? "Turn music on" : "Turn music off"}
        onClick={toggleMusic}
        style={{
          position: "absolute",
          top: "max(14px, env(safe-area-inset-top))",
          left: 16,
          zIndex: 5,
          fontSize: 15,
          lineHeight: 1,
          color: "var(--ink-dim)",
          background: "rgba(253,246,227,0.06)",
          border: "1px solid rgba(253,246,227,0.14)",
          borderRadius: 999,
          width: 34,
          height: 34,
          minHeight: 0,
          padding: 0,
        }}
      >
        {musicOff ? "♪̶" : "♪"}
      </button>

      {/* tiny judge-facing affordance to open the studio panel */}
      <button
        className="studio-toggle"
        aria-label="Open the studio panel"
        onClick={() => setShowStudio(true)}
        style={{
          position: "absolute",
          top: "max(14px, env(safe-area-inset-top))",
          right: 16,
          zIndex: 5,
          fontSize: 12,
          letterSpacing: 1,
          color: "var(--ink-dim)",
          background: "rgba(253,246,227,0.06)",
          border: "1px solid rgba(253,246,227,0.14)",
          borderRadius: 999,
          padding: "7px 12px",
          minHeight: 0,
        }}
      >
        studio
      </button>

      {phase === "ask" && (
        <GrownupAsk onStart={startStory} onInstant={startInstantDemo} notice={notice} />
      )}
      {phase === "conjure" && <Conjuring name={lastReqName.current} />}
      {phase === "story" && response && narrator && (
        <Story response={response} narrator={narrator} onRestart={restart} />
      )}

      {showStudio && (
        <StudioPanel onClose={() => setShowStudio(false)} lastResponse={response} />
      )}
    </div>
  );
}
