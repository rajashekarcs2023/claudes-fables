// The pre-seeded demo library. These three fables ship as static JSON so:
//   1. the demo's hero example loads instantly (no API call), and
//   2. they double as the fallback library — on ANY live-generation failure we
//      silently serve the nearest demo so a child never sees an error screen.
//
// Used by BOTH the server (src/server/fable.ts) and the client (App.tsx), so it
// stays pure (no node/browser APIs).

import type { AgeBand, Fable } from "../types";
import sharing from "../../demo/sharing.json";
import fearOfDark from "../../demo/fear-of-dark.json";
import honesty from "../../demo/honesty.json";

interface DemoEntry {
  /** the lesson chip/key this demo represents */
  key: string;
  /** canonical hero name stored in the JSON, replaced at pick time */
  canonicalName: string;
  /** keywords that route a free-text situation to this demo */
  keywords: string[];
  fable: Fable;
}

export const DEMOS: DemoEntry[] = [
  {
    key: "sharing",
    canonicalName: "Maya",
    keywords: ["shar", "selfish", "mine", "take turns", "turn", "give", "greedy", "toys", "toy"],
    fable: sharing as Fable,
  },
  {
    key: "fear-of-dark",
    canonicalName: "Sam",
    keywords: [
      "dark", "scared", "afraid", "fear", "night", "monster", "brave",
      "bravery", "courage", "nightmare", "alone", "sleep",
    ],
    fable: fearOfDark as Fable,
  },
  {
    key: "honesty",
    canonicalName: "Ravi",
    keywords: [
      "honest", "truth", "lie", "lying", "fib", "broke", "sorry",
      "apolog", "mistake", "owning", "admit", "confess",
    ],
    fable: honesty as Fable,
  },
];

/** The three keys, in demo-shelf order. */
export const DEMO_KEYS = DEMOS.map((d) => d.key);

function deepReplaceName<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") {
    // word-boundary replace so "Maya" -> name but "Maya's" -> "<name>'s"
    return value.replace(new RegExp(`\\b${from}\\b`, "g"), to) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepReplaceName(v, from, to)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepReplaceName(v, from, to);
    }
    return out as unknown as T;
  }
  return value;
}

function titleCase(name: string): string {
  const n = name.trim();
  if (!n) return n;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Find the demo entry whose lesson best matches a situation string. */
export function matchDemoEntry(situation: string): DemoEntry {
  const s = (situation || "").toLowerCase();
  for (const d of DEMOS) {
    if (d.key === s) return d; // exact chip key
    if (d.keywords.some((k) => s.includes(k))) return d;
  }
  // default hero example is sharing — the canonical demo
  return DEMOS[0];
}

/**
 * Return a ready-to-render fable for a situation, cast for this child.
 * Used for the instant demo path and as the fallback when live generation fails.
 */
export function pickDemo(
  situation: string,
  childName: string,
  ageBand: AgeBand = "4-6",
): Fable {
  const entry = matchDemoEntry(situation);
  const name = titleCase(childName) || entry.canonicalName;
  const cast = deepReplaceName(entry.fable, entry.canonicalName, name);
  return { ...cast, child_name: name, age_band: ageBand };
}

/** Direct lookup by demo key (sharing | fear-of-dark | honesty), cast for the child. */
export function getDemoByKey(
  key: string,
  childName: string,
  ageBand: AgeBand = "4-6",
): Fable {
  const entry = DEMOS.find((d) => d.key === key) ?? DEMOS[0];
  const name = titleCase(childName) || entry.canonicalName;
  const cast = deepReplaceName(entry.fable, entry.canonicalName, name);
  return { ...cast, child_name: name, age_band: ageBand };
}
