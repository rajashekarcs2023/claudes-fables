import { useEffect, useRef, useState } from "react";
import type { AgeBand, FableRequest, FableResponse } from "./types";
import { requestFable } from "./lib/api";
import { getDemoByKey } from "./lib/demos";
import { primeVoices } from "./lib/narration";
import GrownupAsk from "./ui/GrownupAsk";
import Story from "./ui/Story";
import StudioPanel from "./ui/StudioPanel";

type Phase = "ask" | "conjure" | "story";

const MIN_CONJURE_MS = 1600; // the wait should feel like magic, not lag

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
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [showStudio, setShowStudio] = useState(false);
  const lastReqName = useRef("Friend");

  // keep the page from scrolling on small screens between phases
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  async function startStory(req: FableRequest) {
    setNotice(undefined);
    lastReqName.current = req.child_name || "Friend";
    primeVoices(); // warm the speech voices on the user's start gesture
    setPhase("conjure");
    const [res] = await Promise.all([requestFable(req), delay(MIN_CONJURE_MS)]);
    if (res.blocked) {
      // gently return to the ask screen — never generate something off-topic
      setNotice(`Let's pick something for ${req.child_name || "tonight"}.`);
      setPhase("ask");
      return;
    }
    setResponse(res);
    setPhase("story");
  }

  async function startInstantDemo(key: string, childName: string, ageBand: AgeBand) {
    setNotice(undefined);
    lastReqName.current = childName || "Friend";
    primeVoices();
    setPhase("conjure");
    await delay(MIN_CONJURE_MS);
    setResponse({ fable: getDemoByKey(key, childName, ageBand), source: "demo" });
    setPhase("story");
  }

  function restart() {
    setResponse(null);
    setNotice(undefined);
    setPhase("ask");
  }

  return (
    <div className="app-shell">
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
      {phase === "story" && response && <Story response={response} onRestart={restart} />}

      {showStudio && (
        <StudioPanel onClose={() => setShowStudio(false)} lastResponse={response} />
      )}
    </div>
  );
}
