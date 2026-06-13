// POST /api/fable — the kid's hot path.
//
// BASELINE PLACEHOLDER: this version serves a pre-seeded demo so the full loop
// works end-to-end before the live generator is wired in. The fable-engine
// module replaces generate-and-validate with ONE claude-opus-4-8 call (buffer
// the full response, strip fences, parse, validate against the schema, retry
// once, then fall back to a demo). The fallback + interface below is final.

import type { AgeBand, CharacterType, FableRequest, FableResponse } from "../types";
import { pickDemo } from "../lib/demos";

const VALID_BANDS: AgeBand[] = ["4-6", "7-9"];
const VALID_HEROES: CharacterType[] = ["crow", "little_bird", "fox", "rabbit", "child"];

// gentle gate: if a parent's input clearly isn't child-appropriate, we don't
// generate — we ask them to pick something instead (handled in the UI).
const BLOCKLIST = [
  "sex", "porn", "nud", "kill", "murder", "suicide", "drug", "cocaine",
  "gun", "weapon", "blood", "gore", "rape", "abuse", "terror", "nazi",
  "fuck", "shit", "bitch",
];

export function isChildAppropriate(situation: string): boolean {
  const s = (situation || "").toLowerCase();
  return !BLOCKLIST.some((w) => s.includes(w));
}

export function normalizeRequest(body: unknown): FableRequest {
  const b = (body || {}) as Record<string, unknown>;
  const situation = typeof b.situation === "string" ? b.situation.trim() : "";
  const child_name =
    typeof b.child_name === "string" && b.child_name.trim()
      ? b.child_name.trim().slice(0, 24)
      : "Friend";
  const age_band = VALID_BANDS.includes(b.age_band as AgeBand)
    ? (b.age_band as AgeBand)
    : "4-6";
  const hero = VALID_HEROES.includes(b.hero as CharacterType)
    ? (b.hero as CharacterType)
    : undefined;
  return { situation, child_name, age_band, hero };
}

/** Last-resort fallback used if anything unexpected happens. Never throws. */
export function emergencyFallback(body: unknown): FableResponse {
  const req = normalizeRequest(body);
  return {
    fable: pickDemo(req.situation || "sharing", req.child_name, req.age_band),
    source: "fallback",
    fallback_reason: "emergency",
  };
}

export async function handleFableRequest(
  body: unknown,
): Promise<{ status: number; body: FableResponse }> {
  const req = normalizeRequest(body);

  if (!isChildAppropriate(req.situation)) {
    return {
      status: 200,
      body: {
        fable: pickDemo("sharing", req.child_name, req.age_band),
        source: "fallback",
        blocked: true,
        fallback_reason: "not_child_appropriate",
      },
    };
  }

  // BASELINE: serve the nearest demo. (fable-engine swaps in the live Opus call.)
  const fable = pickDemo(req.situation || "sharing", req.child_name, req.age_band);
  return { status: 200, body: { fable, source: "demo" } };
}
