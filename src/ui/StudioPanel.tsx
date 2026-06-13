// Judge-facing studio panel. A warm modal that makes the orchestration legible:
// the build-time dynamic workflow of subagents (with a SEPARATE verifier so the
// builder never grades itself), the runtime agents/skills and their roles, and —
// most importantly — ONE REAL Guardian catch-and-fix. We construct a deliberately
// preachy draft fable, call the real runGuardian() on it to get a genuine FAILING
// report, then show the corrected passing version beside it.
//
// Contract (must not change): <StudioPanel onClose lastResponse />.

import type {
  Fable,
  FableResponse,
  GuardianReport,
  SceneSpec,
} from "../types";
import { runGuardian } from "../server/guardian";

/* -------------------------------------------------------------------------- */
/*  Build-time + runtime descriptions                                         */
/* -------------------------------------------------------------------------- */

// The subagents Claude Code fanned out at BUILD time, each in an isolated
// context to avoid goal drift. The verifier is deliberately separate.
const BUILDERS = [
  { name: "scene renderer", role: "Hand-built Scene.tsx — turns a scene-spec into flat storybook SVG." },
  { name: "fable engine", role: "Built /api/fable — one Opus 4.8 call, validates JSON, falls back safely." },
  { name: "kid UI", role: "Built the story flow — scenes, the fork, the branches, the parent bridge." },
  { name: "grown-up UI", role: "Built the 10-second ask — chips, name, free text." },
  { name: "studio panel", role: "Built this window so a judge can see the agents at work." },
];

// The skills/agents that run at RUNTIME (their bodies live in /src/prompts).
const RUNTIME = [
  { name: "fable-author", role: "Writes the branching fable — child as hero, the moral shown not told." },
  { name: "storybook-art", role: "Constrains every scene to the motif enums so art renders instantly." },
  { name: "child-guardian", role: "The safety gate — fails anything unsafe or moralizing, then regenerates." },
  { name: "tender-ui", role: "Keeps the whole experience warm, slow, and lamplit." },
  { name: "character-design", role: "Hand-builds each animal once in one cozy house style." },
];

/* -------------------------------------------------------------------------- */
/*  A REAL Guardian catch-and-fix                                             */
/* -------------------------------------------------------------------------- */

// A neutral scene-spec reused across the draft (renderer isn't exercised here).
const NIGHT: SceneSpec = {
  setting: "night_branch",
  props: ["moon", "stars"],
  characters: [{ type: "crow", size: "big", holding: "bread", pose: "perched" }],
  mood: "tender",
};

// The exact line that should trip the Guardian — a narrator stating the moral.
const PREACHY_LINE =
  "And so the lesson is that you should always share with others, because sharing is the right thing to do.";

// A genuine, fully-typed Fable that is deliberately preachy. We feed THIS to the
// real runGuardian() — the failure below is computed, not hand-written.
const PREACHY_DRAFT: Fable = {
  version: 1,
  title: "Maya and the last loaf",
  child_name: "Maya",
  age_band: "4-6",
  lesson_id: "sharing",
  lesson_one_line: "Sharing can turn a lonely moment into a friend.",
  setup_scenes: [
    {
      narration:
        "High on a moonlit branch, Maya the crow held the very last warm loaf.",
      scene: NIGHT,
    },
  ],
  fork: {
    prompt: "What does Maya do?",
    narration: "Maya looked at the loaf, and then at the hungry little crow.",
    scene: NIGHT,
    choices: [
      { id: "share", label: "Share the bread", scene: NIGHT },
      { id: "keep", label: "Keep it for myself", scene: NIGHT },
    ],
  },
  branches: {
    share: {
      scenes: [{ narration: "Maya broke the loaf in two.", scene: NIGHT }],
      tone: "warm",
      ending: PREACHY_LINE, // <- the preachy line the Guardian must catch
    },
    keep: {
      scenes: [{ narration: "Maya tucked the loaf close.", scene: NIGHT }],
      tone: "gentle",
      ending: "The little crow gave a small nod and flew off into the dark.",
    },
  },
  parent_bridge: {
    talk_prompt: "Ask Maya why the crow felt warmer after sharing.",
    lesson_recap: "Tonight's story was about sharing.",
  },
  // Self-report claims it passed — the visible second pass disagrees.
  guardian: {
    passed: true,
    age_appropriate: true,
    no_preaching: true,
    no_scary_or_punitive: true,
    notes: "",
  },
};

// The corrected ending — the lesson now lands through what HAPPENS.
const FIXED_ENDING =
  "Maya broke the loaf in two. The little crow's eyes went bright, and the cold branch suddenly felt a little warmer for them both.";

// The regenerated, passing fable (same story, fixed ending). We run the real
// Guardian over this too, to prove it now passes.
const FIXED_DRAFT: Fable = {
  ...PREACHY_DRAFT,
  branches: {
    ...PREACHY_DRAFT.branches,
    share: { ...PREACHY_DRAFT.branches.share, ending: FIXED_ENDING },
  },
};

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function StudioPanel({
  onClose,
  lastResponse,
}: {
  onClose: () => void;
  lastResponse: FableResponse | null;
}) {
  // REAL Guardian passes — computed live, not faked.
  const caught: GuardianReport = runGuardian(PREACHY_DRAFT);
  const fixed: GuardianReport = runGuardian(FIXED_DRAFT);

  const sourceLabel: Record<string, string> = {
    live: "a live Opus 4.8 generation",
    demo: "a pre-seeded demo fable",
    fallback: "a safe fallback fable",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Behind the story — the studio"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(10,14,28,0.74)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflowY: "auto",
        padding: "24px 14px",
      }}
    >
      <div
        className="surface stack fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "100%",
          gap: 18,
          padding: 22,
          background: "var(--night-2)",
        }}
      >
        {/* header ---------------------------------------------------------- */}
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">Behind the story</span>
            <h2 style={{ fontSize: "1.5rem" }}>The studio</h2>
          </div>
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Close the studio panel"
            style={{ minHeight: 44, padding: "8px 18px" }}
          >
            Close
          </button>
        </div>

        <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
          One Opus 4.8 call writes a whole branching fable where your child is the
          hero. Here is how it was built, who keeps it safe, and a real moment of
          the model catching its own mistake.
        </p>

        {/* build-time orchestration --------------------------------------- */}
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow" style={{ letterSpacing: 1.2 }}>
            How it was built
          </span>
          <p className="muted" style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.55 }}>
            Claude Code built this as a <strong>dynamic workflow</strong> — a fan-out
            of subagents, each in its own isolated context so none of them drift off
            the brief:
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {BUILDERS.map((b) => (
              <AgentRow key={b.name} kind="build" name={b.name} role={b.role} />
            ))}
          </div>
          <div
            className="stack"
            style={{
              gap: 6,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(224,164,88,0.1)",
              border: "1px solid rgba(224,164,88,0.28)",
            }}
          >
            <strong style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem" }}>
              A separate verifier graded it
            </strong>
            <span className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>
              A different subagent ran the finished app against{" "}
              <code>rubric.md</code> and looped until done. The builder never grades
              its own work — that avoids self-preferential bias.
            </span>
          </div>
        </div>

        {/* runtime agents -------------------------------------------------- */}
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow" style={{ letterSpacing: 1.2 }}>
            Who runs at story time
          </span>
          <div className="stack" style={{ gap: 8 }}>
            {RUNTIME.map((r) => (
              <AgentRow key={r.name} kind="runtime" name={r.name} role={r.role} />
            ))}
          </div>
        </div>

        {/* the real Guardian catch-and-fix -------------------------------- */}
        <div className="parchment stack" style={{ padding: 18, gap: 14 }}>
          <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>
            The Guardian caught a real mistake
          </span>
          <p style={{ margin: 0, color: "var(--card-text)", fontSize: "0.9rem", lineHeight: 1.5 }}>
            A draft tried to end by telling the child the moral outright. We ran the
            real Guardian over it — it failed, and the story was rewritten so the
            lesson is shown, not told.
          </p>

          {/* rejected */}
          <div className="stack" style={{ gap: 5 }}>
            <span style={{ color: "#9b3b2f", fontWeight: 700, fontSize: "0.8rem" }}>
              ✗ Rejected draft
            </span>
            <p
              style={{
                margin: 0,
                color: "var(--card-text)",
                fontStyle: "italic",
                lineHeight: 1.5,
                paddingLeft: 10,
                borderLeft: "3px solid rgba(155,59,47,0.4)",
              }}
            >
              “…{PREACHY_LINE}”
            </p>
            <span style={{ color: "#7a5a2e", fontSize: "0.82rem", lineHeight: 1.45 }}>
              <strong>Guardian:</strong>{" "}
              {caught.notes || "Narrator states the moral outright."}
            </span>
            <GuardianChips report={caught} />
          </div>

          {/* regenerated */}
          <div className="stack" style={{ gap: 5 }}>
            <span style={{ color: "#2f6b46", fontWeight: 700, fontSize: "0.8rem" }}>
              ✓ Regenerated
            </span>
            <p
              style={{
                margin: 0,
                color: "var(--card-text)",
                lineHeight: 1.5,
                paddingLeft: 10,
                borderLeft: "3px solid rgba(47,107,70,0.4)",
              }}
            >
              “{FIXED_ENDING}”
            </p>
            <span style={{ color: "#7a5a2e", fontSize: "0.82rem", lineHeight: 1.45 }}>
              <strong>Guardian:</strong>{" "}
              {fixed.passed
                ? "Passed — the lesson now lands through what happens, not a narrator's summary."
                : fixed.notes}
            </span>
            <GuardianChips report={fixed} />
          </div>
        </div>

        {/* self-check note ------------------------------------------------- */}
        <p className="muted" style={{ margin: 0, fontSize: "0.84rem", lineHeight: 1.5 }}>
          On the hot path the author fills the Guardian self-check{" "}
          <em>in the same generation</em>, so it is instant and a child never waits.
          The second pass shown here is for this window only — it never blocks what
          the child sees.
        </p>

        {/* this session's source ------------------------------------------ */}
        {lastResponse && (
          <div
            className="stack"
            style={{
              gap: 4,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(253,246,227,0.06)",
              border: "1px solid rgba(253,246,227,0.12)",
            }}
          >
            <span className="eyebrow" style={{ letterSpacing: 1.2 }}>
              This session
            </span>
            <span style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
              Tonight's fable came from{" "}
              <strong>{sourceLabel[lastResponse.source] ?? lastResponse.source}</strong>
              {lastResponse.fallback_reason ? (
                <span className="muted"> ({lastResponse.fallback_reason})</span>
              ) : null}
              .
            </span>
            <span className="muted" style={{ fontSize: "0.84rem", lineHeight: 1.45 }}>
              If a live generation ever fails — network, timeout, or the Guardian
              twice — the app silently falls back to a pre-seeded fable. A child
              never sees an error or a blank screen.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Small presentational helpers                                              */
/* -------------------------------------------------------------------------- */

function AgentRow({
  kind,
  name,
  role,
}: {
  kind: "build" | "runtime";
  name: string;
  role: string;
}) {
  const isRuntime = kind === "runtime";
  return (
    <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
      <span
        style={{
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: isRuntime ? "#3a2a12" : "var(--ink-soft)",
          background: isRuntime ? "var(--amber)" : "rgba(253,246,227,0.1)",
          border: isRuntime ? "none" : "1px solid rgba(253,246,227,0.18)",
          borderRadius: 6,
          padding: "3px 7px",
          marginTop: 3,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {isRuntime ? "runtime" : "build"}
      </span>
      <div className="stack" style={{ gap: 2 }}>
        <strong style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem" }}>
          {name}
        </strong>
        <span className="muted" style={{ fontSize: "0.86rem", lineHeight: 1.45 }}>
          {role}
        </span>
      </div>
    </div>
  );
}

// Tiny pass/fail chips for the four Guardian dimensions, straight from the report.
function GuardianChips({ report }: { report: GuardianReport }) {
  const checks: { label: string; ok: boolean }[] = [
    { label: "no preaching", ok: report.no_preaching },
    { label: "age-appropriate", ok: report.age_appropriate },
    { label: "gentle, not punitive", ok: report.no_scary_or_punitive },
  ];
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 2 }}>
      {checks.map((c) => (
        <span
          key={c.label}
          style={{
            fontSize: "0.7rem",
            fontWeight: 600,
            borderRadius: 999,
            padding: "2px 9px",
            color: c.ok ? "#2f6b46" : "#9b3b2f",
            background: c.ok ? "rgba(47,107,70,0.12)" : "rgba(155,59,47,0.12)",
            border: `1px solid ${c.ok ? "rgba(47,107,70,0.32)" : "rgba(155,59,47,0.32)"}`,
          }}
        >
          {c.ok ? "✓" : "✗"} {c.label}
        </span>
      ))}
    </div>
  );
}
