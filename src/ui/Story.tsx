// The kid loop — steps 3-6: setup scenes, the equal-weight fork, the chosen
// branch's consequence, and the parent bridge. Voice narration throughout.
//
// PLACEHOLDER owned by the kid-ui module (which applies the full tender-ui
// warmth). This version is fully functional so the loop ships. Contract:
//   <Story response={FableResponse} onRestart={() => void} />

import { useCallback, useEffect, useRef, useState } from "react";
import type { FableResponse, NarratedScene } from "../types";
import Scene from "../scene/Scene";
import { speak, cancelNarration, type SpeakHandle } from "../lib/narration";

type Stage = "setup" | "fork" | "branch" | "bridge";

export default function Story({
  response,
  onRestart,
}: {
  response: FableResponse;
  onRestart: () => void;
}) {
  const fable = response.fable;
  const [stage, setStage] = useState<Stage>("setup");
  const [idx, setIdx] = useState(0);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const handleRef = useRef<SpeakHandle | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef<() => void>(() => {});

  const branch = choiceId ? fable.branches[choiceId] : null;

  // ---- what is on screen right now ----------------------------------------
  let currentScene: NarratedScene["scene"] | null = null;
  let text = "";
  let auto = false;
  let onDone: () => void = () => {};

  if (stage === "setup") {
    const s = fable.setup_scenes[idx];
    currentScene = s.scene;
    text = s.narration;
    auto = true;
    onDone = () => {
      if (idx + 1 < fable.setup_scenes.length) setIdx(idx + 1);
      else {
        setIdx(0);
        setStage("fork");
      }
    };
  } else if (stage === "fork") {
    currentScene = fable.fork.scene;
    text = fable.fork.narration;
    auto = false;
  } else if (stage === "branch" && branch) {
    const s = branch.scenes[idx];
    currentScene = s.scene;
    text = s.narration;
    auto = true;
    onDone = () => {
      if (idx + 1 < branch.scenes.length) setIdx(idx + 1);
      else setStage("bridge");
    };
  } else if (stage === "bridge" && branch) {
    currentScene = branch.scenes[branch.scenes.length - 1].scene;
    text = branch.ending;
    auto = false;
  }
  onDoneRef.current = onDone;

  const clearAdvance = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const narrate = useCallback((passage: string, isAuto: boolean) => {
    clearAdvance();
    handleRef.current?.cancel();
    handleRef.current = speak(passage, {
      onStart: () => setReading(true),
      onEnd: () => {
        setReading(false);
        if (isAuto) {
          advanceTimer.current = setTimeout(() => onDoneRef.current(), 850);
        }
      },
    });
  }, []);

  // narrate whenever the on-screen beat changes
  useEffect(() => {
    if (text) narrate(text, auto);
    return () => {
      clearAdvance();
      handleRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idx, choiceId]);

  // stop narration when leaving the story
  useEffect(() => () => cancelNarration(), []);

  const replay = () => {
    if (text) narrate(text, auto);
  };

  const manualAdvance = () => {
    clearAdvance();
    handleRef.current?.cancel();
    setReading(false);
    onDoneRef.current();
  };

  const choose = (id: string) => {
    clearAdvance();
    handleRef.current?.cancel();
    setChoiceId(id);
    setIdx(0);
    setStage("branch");
  };

  return (
    <div className="stack grow" style={{ gap: 16, paddingTop: 28 }}>
      {/* scene picture (tap to hear it again) */}
      {currentScene && (
        <button
          key={`${stage}-${idx}-${choiceId}`}
          onClick={replay}
          aria-label="Tap to hear this again"
          className="fade-in"
          style={{ padding: 0, borderRadius: 18, background: "none" }}
        >
          <Scene spec={currentScene} />
        </button>
      )}

      {/* reading dot */}
      <div className="row" style={{ gap: 10, justifyContent: "center", minHeight: 14 }}>
        {reading && <span className="reading-dot" aria-hidden />}
        {reading && <span className="muted" style={{ fontSize: "0.8rem" }}>reading to you…</span>}
      </div>

      {/* narration text */}
      <p className="narration center fade-in" key={text} style={{ minHeight: 84 }}>
        {text}
      </p>

      {/* stage-specific controls */}
      {(stage === "setup" || stage === "branch") && (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn-ghost" onClick={manualAdvance}>
            Next ›
          </button>
        </div>
      )}

      {stage === "fork" && (
        <div className="stack" style={{ gap: 14 }}>
          <p className="eyebrow center">{fable.fork.prompt}</p>
          {/* two choice cards, EQUAL visual weight — no "right answer" glow */}
          <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
            {fable.fork.choices.map((c) => (
              <button
                key={c.id}
                onClick={() => choose(c.id)}
                className="parchment"
                style={{
                  flex: 1,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  alignItems: "center",
                  animation: "breathe 4.5s ease-in-out infinite",
                }}
              >
                <Scene spec={c.scene} />
                <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.05rem", color: "var(--card-text)" }}>
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === "bridge" && branch && (
        <div className="stack" style={{ gap: 14 }}>
          {branch.explore_offer && (
            <p className="muted center" style={{ margin: 0 }}>{branch.explore_offer}</p>
          )}
          {/* the parent bridge — the most important screen */}
          <div className="parchment stack" style={{ padding: 20, gap: 10 }}>
            <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>Tonight, together</span>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", color: "var(--card-text)", margin: 0, lineHeight: 1.5 }}>
              {fable.parent_bridge.talk_prompt}
            </p>
            <p style={{ color: "var(--card-text)", opacity: 0.7, margin: 0, fontSize: "0.92rem" }}>
              {fable.parent_bridge.lesson_recap}
            </p>
          </div>
          <button className="btn-ghost" onClick={onRestart}>
            Tell another tale
          </button>
        </div>
      )}

      <div className="grow" />
    </div>
  );
}
