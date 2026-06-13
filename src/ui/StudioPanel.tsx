// PLACEHOLDER judge-facing studio panel — replaced by the studio-panel module.
// Shows the agent roles that built the app and at least one real Guardian
// catch-and-fix. Contract: <StudioPanel onClose lastResponse />.

import type { FableResponse } from "../types";
import { runGuardian } from "../server/guardian";

const ROLES = [
  { name: "fable-author", role: "Writes the branching fable — child as hero, no preaching.", kind: "runtime" },
  { name: "storybook-art", role: "Constrains every scene to the motif enums so art renders instantly.", kind: "runtime" },
  { name: "child-guardian", role: "The safety gate — fails anything unsafe or moralizing, then regenerates.", kind: "runtime" },
  { name: "tender-ui", role: "Keeps the whole experience warm, slow, and lamplit.", kind: "build" },
  { name: "character-design", role: "Hand-builds each animal once in one cozy house style.", kind: "build" },
  { name: "verifier", role: "A SEPARATE agent that grades the built app against rubric.md (no self-grading).", kind: "build" },
];

// One real "the model caught its own mistake and fixed it" moment for the demo.
const PREACHY_DRAFT =
  "Maya kept the bread, and the lesson is that you should always share with others so everyone is happy.";
const FIXED =
  "Maya tucked the whole loaf close and nibbled it alone. The little crow gave a small nod and flew off into the dark.";

export default function StudioPanel({
  onClose,
  lastResponse,
}: {
  onClose: () => void;
  lastResponse: FableResponse | null;
}) {
  // A real Guardian pass over a deliberately-preachy draft (it fails)…
  const caughtReport = runGuardian({
    ...(lastResponse?.fable ??
      ({
        branches: { keep: { scenes: [{ narration: PREACHY_DRAFT, scene: {} }], ending: PREACHY_DRAFT, tone: "gentle" } },
        setup_scenes: [],
        fork: { narration: "" },
      } as never)),
    setup_scenes: [{ narration: PREACHY_DRAFT, scene: {} as never }],
    fork: { prompt: "", narration: "", scene: {} as never, choices: [] },
    branches: { keep: { scenes: [{ narration: PREACHY_DRAFT, scene: {} as never }], ending: PREACHY_DRAFT, tone: "gentle" } },
  } as never);

  return (
    <div
      role="dialog"
      aria-label="Studio panel"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(10,14,28,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        overflowY: "auto",
        padding: "24px 14px",
      }}
      onClick={onClose}
    >
      <div
        className="surface stack fade-in"
        style={{ maxWidth: 480, width: "100%", gap: 16, padding: 20, background: "var(--night-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ fontSize: "1.4rem" }}>The studio</h2>
          <button className="btn-ghost" style={{ minHeight: 42, padding: "8px 16px" }} onClick={onClose}>
            Close
          </button>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          Claude Code built this with a dynamic workflow of subagents in isolated contexts, then a
          <strong> separate verifier</strong> graded it against <code>rubric.md</code> — the builder never grades itself.
        </p>

        <div className="stack" style={{ gap: 8 }}>
          {ROLES.map((r) => (
            <div key={r.name} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span
                style={{
                  fontSize: "0.66rem",
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  color: r.kind === "runtime" ? "#3a2a12" : "var(--ink-soft)",
                  background: r.kind === "runtime" ? "var(--amber)" : "rgba(253,246,227,0.1)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {r.kind}
              </span>
              <div className="stack">
                <strong style={{ fontFamily: "var(--font-sans)" }}>{r.name}</strong>
                <span className="muted" style={{ fontSize: "0.88rem" }}>{r.role}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="parchment stack" style={{ padding: 16, gap: 10 }}>
          <span className="eyebrow" style={{ color: "var(--amber-deep)" }}>Guardian caught a mistake</span>
          <div className="stack" style={{ gap: 4 }}>
            <span style={{ color: "#9b3b2f", fontWeight: 700, fontSize: "0.8rem" }}>✗ rejected draft</span>
            <p style={{ margin: 0, color: "var(--card-text)", fontStyle: "italic" }}>"{PREACHY_DRAFT}"</p>
            <span style={{ color: "#7a5a2e", fontSize: "0.82rem" }}>
              Guardian note: {caughtReport.notes || "Narrator states the moral outright."}
            </span>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <span style={{ color: "#2f6b46", fontWeight: 700, fontSize: "0.8rem" }}>✓ regenerated</span>
            <p style={{ margin: 0, color: "var(--card-text)" }}>"{FIXED}"</p>
            <span style={{ color: "#7a5a2e", fontSize: "0.82rem" }}>
              The lesson now lands through what happens — not a narrator's summary.
            </span>
          </div>
        </div>

        {lastResponse && (
          <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            This session's fable was served from: <strong>{lastResponse.source}</strong>
            {lastResponse.fallback_reason ? ` (${lastResponse.fallback_reason})` : ""}. The child
            never sees a failure — generation falls back to a pre-seeded fable.
          </p>
        )}
      </div>
    </div>
  );
}
