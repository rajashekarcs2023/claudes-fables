// Optional VISIBLE second-pass Guardian check (studio panel / demo only).
//
// On the hot path the fable-author fills the guardian self-report fields in the
// SAME generation (fast) — a child never waits on this. This module exists so
// the studio panel can show one real "the model caught its own mistake and
// fixed it" moment, per the child-guardian skill and rubric Part B.
//
// BASELINE: a lightweight heuristic pass. The fable-engine module may upgrade
// this to a second claude-opus-4-8 call for the demo, but it MUST never block
// what the child sees.

import type { Fable, GuardianReport } from "../types";

// Phrases that mean a narrator is stating the moral outright (no preaching rule).
const PREACHY = [
  "the lesson is",
  "this shows that",
  "the moral",
  "remember to always",
  "remember to share",
  "you should always",
  "that's why you should",
  "it is important to",
  "teaches us",
  "always be",
];

// Words that would make the "other" choice scary or punitive (safety rule).
const SCARY = [
  "punish",
  "scream",
  "terrified",
  "blood",
  "die",
  "dead",
  "monster attacked",
  "hit ",
  "hurt badly",
  "screamed",
];

function allNarration(fable: Fable): string {
  const parts: string[] = [];
  for (const s of fable.setup_scenes) parts.push(s.narration);
  parts.push(fable.fork.narration);
  for (const key of Object.keys(fable.branches)) {
    for (const s of fable.branches[key].scenes) parts.push(s.narration);
    parts.push(fable.branches[key].ending);
  }
  return parts.join(" \n ").toLowerCase();
}

export function runGuardian(fable: Fable): GuardianReport {
  const text = allNarration(fable);
  const preachHit = PREACHY.find((p) => text.includes(p));
  const scaryHit = SCARY.find((p) => text.includes(p));

  const no_preaching = !preachHit;
  const no_scary_or_punitive = !scaryHit;
  // age-appropriateness leans on the self-report unless we caught something.
  const age_appropriate = no_scary_or_punitive && fable.guardian?.age_appropriate !== false;
  const passed = no_preaching && no_scary_or_punitive && age_appropriate;

  const notes = passed
    ? ""
    : preachHit
    ? `Narrator states the moral ("${preachHit}") — show it through consequence instead.`
    : scaryHit
    ? `Consequence reads as scary/punitive ("${scaryHit.trim()}") — keep it gentle.`
    : "Failed a safety or pedagogy check.";

  return { passed, age_appropriate, no_preaching, no_scary_or_punitive, notes };
}
