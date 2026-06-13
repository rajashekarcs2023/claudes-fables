// The kid loop — steps 3-6 of the locked experience: the setup scenes, the
// equal-weight fork, the chosen branch's consequence (warm or gentle, never
// punishing), and the parent bridge. Voice narration carries the whole story —
// the child may not read, so on-screen text stays minimal.
//
// The feeling (tender-ui): being read to under a warm lamp. Everything
// cross-fades, nothing snaps. No scores, no win/lose, no praise, no lecturing.
//
// Contract (preserved exactly):
//   <Story response={FableResponse} onRestart={() => void} />

import { useCallback, useEffect, useRef, useState } from "react";
import type { FableResponse, NarratedScene, SceneSpec } from "../types";
import Scene from "../scene/Scene";
import { speak, cancelNarration, type SpeakHandle } from "../lib/narration";

type Stage = "setup" | "fork" | "branch" | "bridge";

// The gentle cross-fade between pictures. The incoming scene fades up from a
// hair below; the outgoing one fades away under it. Soft, never a hard cut.
const STORY_KEYFRAMES = `
@keyframes scene-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scene-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
`;

// A single on-screen beat: a picture + the words read over it.
interface Beat {
  scene: SceneSpec | null;
  text: string;
  // auto beats advance themselves once the narration finishes; manual beats
  // (the fork, the closing bridge) wait for the grown-up/child to move on.
  auto: boolean;
  // a stable identity so we know when the picture/words actually changed and a
  // cross-fade should play.
  key: string;
}

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
  // which choice card is being pressed — drives the soft, slow scale-down.
  const [pressing, setPressing] = useState<string | null>(null);

  const handleRef = useRef<SpeakHandle | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef<() => void>(() => {});

  const branch = choiceId ? fable.branches[choiceId] : null;

  // ---- resolve the current beat from the stage -----------------------------
  let beat: Beat;
  let onDone: () => void = () => {};

  if (stage === "setup") {
    const s: NarratedScene = fable.setup_scenes[idx];
    beat = { scene: s.scene, text: s.narration, auto: true, key: `setup-${idx}` };
    onDone = () => {
      if (idx + 1 < fable.setup_scenes.length) setIdx(idx + 1);
      else {
        setIdx(0);
        setStage("fork");
      }
    };
  } else if (stage === "fork") {
    beat = { scene: fable.fork.scene, text: fable.fork.narration, auto: false, key: "fork" };
  } else if (stage === "branch" && branch) {
    const s = branch.scenes[idx];
    beat = { scene: s.scene, text: s.narration, auto: true, key: `branch-${choiceId}-${idx}` };
    onDone = () => {
      if (idx + 1 < branch.scenes.length) setIdx(idx + 1);
      else setStage("bridge");
    };
  } else if (stage === "bridge" && branch) {
    const last = branch.scenes[branch.scenes.length - 1];
    beat = { scene: last.scene, text: branch.ending, auto: false, key: "bridge" };
  } else {
    // defensive: should never happen, but never blank-screen a child.
    beat = { scene: null, text: "", auto: false, key: "empty" };
  }
  onDoneRef.current = onDone;

  // ---- narration plumbing --------------------------------------------------
  const clearAdvance = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const narrate = useCallback((passage: string, isAuto: boolean) => {
    clearAdvance();
    handleRef.current?.cancel();
    if (!passage) {
      setReading(false);
      return;
    }
    handleRef.current = speak(passage, {
      onStart: () => setReading(true),
      onEnd: () => {
        setReading(false);
        // a longer breath between scenes before the next beat drifts in.
        if (isAuto) {
          advanceTimer.current = setTimeout(() => onDoneRef.current(), 900);
        }
      },
    });
  }, []);

  // Narrate whenever the beat changes. The very first utterance is allowed to
  // start here on mount — the parent already tapped "Begin", which is the
  // required user gesture, so audio is unblocked.
  useEffect(() => {
    narrate(beat.text, beat.auto);
    return () => {
      clearAdvance();
      handleRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.key]);

  // Hard stop narration if the whole story unmounts (e.g. restart).
  useEffect(() => () => cancelNarration(), []);

  // ---- controls ------------------------------------------------------------
  // Tap the picture to hear the current beat again.
  const replay = () => narrate(beat.text, beat.auto);

  const manualAdvance = () => {
    clearAdvance();
    handleRef.current?.cancel();
    setReading(false);
    onDoneRef.current();
  };

  const choose = (id: string) => {
    clearAdvance();
    handleRef.current?.cancel();
    setReading(false);
    setPressing(null);
    setChoiceId(id);
    setIdx(0);
    setStage("branch");
  };

  // ---- render --------------------------------------------------------------
  const atFork = stage === "fork";

  return (
    <div className="stack grow" style={{ gap: 18, paddingTop: 24 }}>
      {/* Cross-fade keyframes for the picture frame. Scoped here because this
          module owns only Story.tsx; the global reduced-motion rule (which
          targets every animation) still collapses these to a quiet swap. */}
      <style>{STORY_KEYFRAMES}</style>

      {/* The picture. A soft cross-fade plays whenever the beat changes — the
          new scene drifts in over a fixed frame, never snapping or sliding. */}
      <SceneStage beatKey={beat.key} spec={beat.scene} onReplay={replay} />

      {/* "I'm reading to you" — a soft glowing dot, kept gentle and quiet. */}
      <div
        className="row"
        style={{ gap: 9, justifyContent: "center", minHeight: 16, opacity: reading ? 1 : 0, transition: "opacity 320ms var(--ease)" }}
        aria-hidden={!reading}
      >
        <span className="reading-dot" />
        <span className="muted" style={{ fontSize: "0.82rem", letterSpacing: "0.3px" }}>
          reading to you…
        </span>
      </div>

      {/* The words — storybook serif, cross-fading with the picture. Kept short;
          the audio carries the story. Hidden at the fork (the cards carry it). */}
      {!atFork && (
        <p
          key={beat.key}
          className="narration center fade-in"
          style={{ minHeight: 92, margin: "0 4px", maxWidth: 420, alignSelf: "center" }}
        >
          {beat.text}
        </p>
      )}

      {/* SETUP / BRANCH — a single gentle way forward. No score, no "next of N". */}
      {(stage === "setup" || stage === "branch") && (
        <div className="row" style={{ justifyContent: "center" }}>
          <button className="btn-ghost" onClick={manualAdvance} aria-label="Go on with the story">
            Go on ›
          </button>
        </div>
      )}

      {/* THE FORK — the child, as the hero, makes the moral choice themselves.
          Two cards of EQUAL visual weight. No right-answer glow, no highlight,
          no nudge. A barely-there resting breathe; a soft slow scale-down on
          press — no bounce, no flash. */}
      {atFork && (
        <div className="stack fade-in" style={{ gap: 18 }}>
          <p
            className="narration center"
            style={{ margin: "0 4px", fontSize: "1.18rem", maxWidth: 420, alignSelf: "center" }}
          >
            {fable.fork.prompt}
          </p>
          <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
            {fable.fork.choices.map((c) => {
              const isPressing = pressing === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => choose(c.id)}
                  onPointerDown={() => setPressing(c.id)}
                  onPointerUp={() => setPressing(null)}
                  onPointerLeave={() => setPressing(null)}
                  className="parchment"
                  aria-label={c.label}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 11,
                    alignItems: "center",
                    // resting breathe, paused while pressing; press gives a
                    // slow scale-down. No transform difference between the two
                    // cards — equal weight, always.
                    transform: isPressing ? "scale(0.965)" : "scale(1)",
                    transition: "transform 480ms var(--ease)",
                    animation: isPressing ? "none" : "breathe 5s ease-in-out infinite",
                    cursor: "pointer",
                  }}
                >
                  <Scene spec={c.scene} className="choice-pic" />
                  <span
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.06rem",
                      lineHeight: 1.3,
                      color: "var(--card-text)",
                      textAlign: "center",
                    }}
                  >
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PARENT BRIDGE — the most important screen, always rendered at the end
          of BOTH branches. Quiet and warm, like tucking-in — not a CTA. If the
          branch carries an explore_offer, it arrives first as a soft wondering. */}
      {stage === "bridge" && branch && (
        <div className="stack fade-in" style={{ gap: 16 }}>
          {branch.explore_offer && (
            <div
              className="surface"
              style={{
                padding: "14px 18px",
                alignSelf: "center",
                maxWidth: 420,
                textAlign: "center",
              }}
            >
              <p
                className="narration"
                style={{ margin: 0, fontSize: "1.05rem", color: "var(--ink-soft)", fontStyle: "italic" }}
              >
                {branch.explore_offer}
              </p>
            </div>
          )}

          <div className="parchment stack" style={{ padding: "22px 22px 24px", gap: 12 }}>
            <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>
              Tonight, together
            </span>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.26rem",
                lineHeight: 1.5,
                color: "var(--card-text)",
                margin: 0,
              }}
            >
              {fable.parent_bridge.talk_prompt}
            </p>
            <p
              style={{
                color: "var(--card-text)",
                opacity: 0.66,
                margin: 0,
                fontSize: "0.94rem",
                lineHeight: 1.45,
              }}
            >
              {fable.parent_bridge.lesson_recap}
            </p>
          </div>

          {/* a gentle, optional offer to make another — never nagging. */}
          <button
            className="btn-ghost"
            onClick={onRestart}
            style={{ alignSelf: "center", marginTop: 2 }}
          >
            Tell another tale
          </button>
        </div>
      )}

      <div className="grow" />
    </div>
  );
}

/**
 * The picture frame. Holds the current scene and cross-fades to it whenever the
 * beat changes: the incoming scene fades up over the outgoing one across ~420ms,
 * so scenes dissolve into each other instead of snapping. Tapping the picture
 * replays the current narration (audio-first, for non-readers).
 *
 * prefers-reduced-motion: the global CSS collapses animation durations, so this
 * naturally degrades to a quiet near-instant fade — no drift, just a clean swap.
 */
function SceneStage({
  beatKey,
  spec,
  onReplay,
}: {
  beatKey: string;
  spec: SceneSpec | null;
  onReplay: () => void;
}) {
  // We keep the previous scene mounted briefly so it can fade out under the new
  // one. `front` is the visible scene; `back` is the fading-out predecessor.
  const [front, setFront] = useState<{ key: string; spec: SceneSpec | null }>({ key: beatKey, spec });
  const [back, setBack] = useState<{ key: string; spec: SceneSpec | null } | null>(null);

  useEffect(() => {
    if (beatKey === front.key) {
      // same beat (e.g. just a replay) — keep the picture, swap spec ref only.
      setFront((f) => ({ ...f, spec }));
      return;
    }
    // a genuinely new beat: push the old one to the back to fade out, bring the
    // new one in at the front.
    setBack(front);
    setFront({ key: beatKey, spec });
    const t = setTimeout(() => setBack(null), 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beatKey, spec]);

  if (!front.spec) return null;

  return (
    <button
      onClick={onReplay}
      aria-label="Tap the picture to hear it again"
      style={{
        position: "relative",
        padding: 0,
        background: "none",
        borderRadius: 18,
        width: "100%",
        lineHeight: 0,
        cursor: "pointer",
      }}
    >
      {/* outgoing scene — fades away beneath the incoming one */}
      {back && back.spec && (
        <div
          key={back.key}
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            animation: "scene-out 520ms var(--ease) both",
          }}
        >
          <Scene spec={back.spec} />
        </div>
      )}
      {/* incoming / current scene — drifts up into view */}
      <div
        key={front.key}
        style={{ position: "relative", animation: "scene-in 520ms var(--ease) both" }}
      >
        <Scene spec={front.spec} />
      </div>
    </button>
  );
}
