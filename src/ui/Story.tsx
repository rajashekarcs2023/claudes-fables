// The kid loop — steps 3-6 — as a cinematic, hands-free bedtime storyteller.
//
// A warm voice (LiveKit/Cartesia, or Web Speech as a fallback) reads the fable
// aloud, scene by scene. The child just listens to the living, softly-animated
// world — and only acts at the fork, where the storyteller asks them aloud and
// they TAP or SPEAK their choice. Then the consequence plays out and the parent
// bridge closes the night. No scores, no win/lose, no lecturing.
//
// Contract: <Story response={FableResponse} narrator={Narrator} onRestart />

import { useEffect, useRef, useState } from "react";
import type { FableResponse, SceneSpec } from "../types";
import Scene from "../scene/Scene";
import type { Narrator } from "../lib/narrator";

function pause(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const STOP_WORDS = new Set([
  "the", "for", "and", "with", "your", "you", "out", "into", "but",
  "all", "her", "his", "him", "she", "they", "them",
]);

/** Words the child might say to pick this choice (for spoken-choice matching). */
function choiceWords(label: string, id: string): string[] {
  const fromLabel = (label.toLowerCase().match(/[a-z]+/g) || []).filter(
    (w) => w.length > 2 && !STOP_WORDS.has(w),
  );
  return Array.from(new Set([...fromLabel, ...id.toLowerCase().split(/[_-]+/)]));
}

/** The storyteller's spoken fork question, warm and by name. */
function forkPrompt(fable: FableResponse["fable"]): string {
  const name = fable.child_name || "little one";
  const [a, b] = fable.fork.choices;
  return `${fable.fork.narration} ${name}, what will you do? ${a.label}? Or ${b.label}?`;
}

export default function Story({
  response,
  narrator,
  onRestart,
}: {
  response: FableResponse;
  narrator: Narrator;
  onRestart: () => void;
}) {
  const fable = response.fable;

  const [scene, setScene] = useState<SceneSpec>(fable.setup_scenes[0].scene);
  const [sceneKey, setSceneKey] = useState(0);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [stage, setStage] = useState<"play" | "fork" | "bridge">("play");
  const [showCards, setShowCards] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [pressing, setPressing] = useState<string | null>(null);

  const cancelled = useRef(false);
  const choiceResolver = useRef<((c: { id: string; viaTap: boolean }) => void) | null>(null);

  const showScene = (s: SceneSpec) => {
    setScene(s);
    setSceneKey((k) => k + 1);
  };

  useEffect(() => {
    cancelled.current = false;
    narrator.onSpeaking(setReading);
    narrator.onChoice((id) => choiceResolver.current?.({ id, viaTap: false }));
    void play();
    return () => {
      cancelled.current = true;
      narrator.setChoices(null);
      narrator.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function say(passage: string): Promise<void> {
    if (cancelled.current) return;
    setText(passage);
    await narrator.narrate(passage);
  }

  async function play(): Promise<void> {
    // a warm spoken hello to open the night
    setStage("play");
    showScene(fable.setup_scenes[0].scene);
    await say(`Hello ${fable.child_name || "little one"}. Snuggle in — your story is beginning.`);
    if (cancelled.current) return;
    await pause(300);

    // 3) setup scenes — read aloud, hands-free
    for (const s of fable.setup_scenes) {
      if (cancelled.current) return;
      showScene(s.scene);
      await say(s.narration);
      if (cancelled.current) return;
      await pause(420);
    }

    // 4) the fork — the storyteller asks; the child taps or speaks
    if (cancelled.current) return;
    setStage("fork");
    showScene(fable.fork.scene);
    await say(forkPrompt(fable));
    if (cancelled.current) return;
    setShowCards(true);
    narrator.setChoices(
      fable.fork.choices.map((c) => ({ id: c.id, label: c.label, words: choiceWords(c.label, c.id) })),
    );
    const { id, viaTap } = await new Promise<{ id: string; viaTap: boolean }>((resolve) => {
      choiceResolver.current = (c) => {
        choiceResolver.current = null;
        resolve(c);
      };
    });
    narrator.setChoices(null);
    setShowCards(false);
    if (cancelled.current) return;

    // The storyteller reacts to the choice out loud. A SPOKEN choice was already
    // acknowledged in the conversation; a TAP gets a warm acknowledgement now.
    if (viaTap) {
      const label = fable.fork.choices.find((c) => c.id === id)?.label ?? "";
      await narrator.acknowledge(label);
      if (cancelled.current) return;
    }
    setChosenId(id);

    // 5) consequence — the chosen branch plays out
    const branch = fable.branches[id];
    setStage("play");
    if (branch) {
      for (const s of branch.scenes) {
        if (cancelled.current) return;
        showScene(s.scene);
        await say(s.narration);
        if (cancelled.current) return;
        await pause(420);
      }
      if (cancelled.current) return;
      await say(branch.ending);
    }

    // 6) parent bridge
    if (cancelled.current) return;
    setStage("bridge");
  }

  const choose = (id: string) => {
    setPressing(null);
    choiceResolver.current?.({ id, viaTap: true });
  };

  const branch = chosenId ? fable.branches[chosenId] : null;

  return (
    <div className="story">
      {/* the living world — a big cinematic band that softly drifts (Ken Burns) */}
      <div className="scene-band">
        <div key={sceneKey} className="scene-layer">
          <Scene spec={scene} />
        </div>
        <div className="scene-scrim" />
      </div>

      {/* the stage: narration, the fork, or the parent bridge */}
      <div className="stage">
        {stage !== "bridge" && (
          <>
            <div className="reading-row" aria-hidden={!reading}>
              <span className="reading-dot" style={{ opacity: reading ? 1 : 0 }} />
            </div>
            <p key={text} className="story-line fade-in">
              {text}
            </p>
          </>
        )}

        {stage === "fork" && showCards && (
          <div className="fork">
            <p className="fork-q">{fable.fork.prompt}</p>
            <div className="fork-cards">
              {fable.fork.choices.map((c) => (
                <button
                  key={c.id}
                  className="choice-card"
                  style={{ transform: pressing === c.id ? "scale(0.96)" : undefined }}
                  onPointerDown={() => setPressing(c.id)}
                  onPointerUp={() => setPressing(null)}
                  onPointerLeave={() => setPressing(null)}
                  onClick={() => choose(c.id)}
                >
                  <span className="choice-pic">
                    <Scene spec={c.scene} />
                  </span>
                  <span className="choice-label">{c.label}</span>
                </button>
              ))}
            </div>
            <p className="fork-hint">tap a picture — or say it out loud</p>
          </div>
        )}

        {stage === "bridge" && branch && (
          <div className="bridge fade-in">
            {branch.explore_offer && <p className="explore">{branch.explore_offer}</p>}
            <div className="bridge-card">
              <span className="bridge-eyebrow">Tonight, together</span>
              <p className="bridge-prompt">{fable.parent_bridge.talk_prompt}</p>
              <p className="bridge-recap">{fable.parent_bridge.lesson_recap}</p>
            </div>
            <button className="btn-ghost" onClick={onRestart}>
              Tell another tale
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
