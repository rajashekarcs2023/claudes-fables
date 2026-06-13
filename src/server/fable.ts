// POST /api/fable — the kid's hot path.
//
// The REAL fable engine: exactly ONE claude-opus-4-8 call, buffered (no partial
// JSON parsing), fence-stripped, parsed, schema-validated, retried once, and —
// on ANY failure — silently fell back to the nearest pre-seeded demo so a child
// never sees an error screen. The big stable system block carries
// cache_control: ephemeral so repeat generations hit the prompt cache and stay
// fast and cheap.
//
// Exports are FINAL and depended on by api/fable.ts, vite.config.ts, and the
// client: handleFableRequest, emergencyFallback, normalizeRequest,
// isChildAppropriate. handleFableRequest never throws.

import Anthropic from "@anthropic-ai/sdk";
import type { AgeBand, CharacterType, Fable, FableRequest, FableResponse } from "../types";
import { pickDemo } from "../lib/demos";
import { validateFable, coerceFable } from "./validateFable";
import {
  fableAuthorPrompt,
  storybookArtPrompt,
  childGuardianPrompt,
} from "../prompts.generated";
import sharing from "../../demo/sharing.json";

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

// ---------------------------------------------------------------------------
// The system block. STABLE prefix (skills + schema + exemplar) — cached.
// Order: fable-author + storybook-art + child-guardian + schema + exemplar +
// the hard "JSON only" instruction. Joined with blank lines.
// ---------------------------------------------------------------------------

const SCHEMA_SPEC = `# Required output JSON schema

Return ONE JSON object matching EXACTLY this shape (the renderer depends on it):

{
  "version": 1,
  "title": "string",
  "child_name": "string (the child's first name)",
  "age_band": "4-6" | "7-9",
  "lesson_id": "string (e.g. sharing, honesty, courage, kindness, owning-a-mistake)",
  "lesson_one_line": "string (the one warm line, for the parent bridge)",
  "setup_scenes": [
    { "narration": "<= 2 sentences, read aloud to a small child", "scene": { /* scene-spec */ } }
  ],
  "fork": {
    "prompt": "What does {name} do?",
    "narration": "string",
    "scene": { /* scene-spec */ },
    "choices": [
      { "id": "share", "label": "Share the bread", "scene": { /* scene-spec */ } },
      { "id": "keep",  "label": "Keep it for myself", "scene": { /* scene-spec */ } }
    ]
  },
  "branches": {
    "share": { "scenes": [ { "narration": "...", "scene": { /* scene-spec */ } } ], "tone": "warm",   "ending": "..." },
    "keep":  { "scenes": [ { "narration": "...", "scene": { /* scene-spec */ } } ], "tone": "gentle", "ending": "...", "explore_offer": "optional, 7-9 only" }
  },
  "parent_bridge": { "talk_prompt": "string, one specific question tied to this story", "lesson_recap": "string" },
  "guardian": { "passed": true, "age_appropriate": true, "no_preaching": true, "no_scary_or_punitive": true, "notes": "" }
}

HARD schema rules:
- "version" is the number 1.
- "age_band" is exactly "4-6" or "7-9".
- The two "fork.choices[].id" values MUST equal the two keys of "branches". (e.g. ids "share"/"keep" => branches has keys "share" and "keep"). The id strings are your choice but must match.
- Each branch "tone" is exactly "warm" (the prosocial outcome) or "gentle" (the other outcome).
- Each narration is AT MOST 2 sentences — these are read aloud to a small child.
- Every "scene" is a scene-spec using ONLY the enums defined in the storybook-art section. If a motif you want doesn't exist, pick the closest one that does. NEVER invent free-form SVG or new enum values.
- Fill the "guardian" self-report fields HONESTLY per the child-guardian rubric.

Length (keep it SHORT — this is read aloud at bedtime AND must generate fast):
- "setup_scenes": EXACTLY 1 scene (the fork's own scene is the next beat).
- Each branch "scenes": EXACTLY 1 scene.
- Every narration is ONE warm sentence (two only if truly needed). Favor the briefest telling.

Casting:
- Cast the child BY NAME as the hero. The child's gender is unknown, so prefer the child's name and avoid gendered pronouns — use the name itself or "they"/"them".`;

const HARD_OUTPUT_INSTRUCTION =
  "Return ONLY one minified JSON object. No markdown, no code fences, no prose.";

const EXEMPLAR_BLOCK =
  "# A perfect example (study its shape, tone, and brevity — then write a fresh one for the given child and situation)\n" +
  JSON.stringify(sharing);

const SYSTEM = [
  fableAuthorPrompt,
  storybookArtPrompt,
  childGuardianPrompt,
  SCHEMA_SPEC,
  EXEMPLAR_BLOCK,
  HARD_OUTPUT_INSTRUCTION,
].join("\n\n");

function buildUserPrompt(req: FableRequest): string {
  const lines = [
    `Situation: "${req.situation}".`,
    `Child's name (the hero): "${req.child_name}".`,
    `Age band: "${req.age_band}".`,
  ];
  if (req.hero) lines.push(`Hero animal: ${req.hero}.`);
  return lines.join(" ");
}

// ---------------------------------------------------------------------------
// JSON extraction — buffer the full text, strip fences, parse; on failure try
// to grab the outermost {...} substring and parse that.
// ---------------------------------------------------------------------------

function stripFences(raw: string): string {
  let t = raw.trim();
  // ```json ... ```  or  ``` ... ```
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z0-9]*\s*/, "").replace(/```\s*$/, "").trim();
  }
  return t;
}

function extractOutermostObject(raw: string): string | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
}

function parseFable(text: string): unknown | null {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const inner = extractOutermostObject(cleaned);
    if (inner) {
      try {
        return JSON.parse(inner);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Force-correct the easy fields so a small model slip doesn't fail validation. */
function forceFields(obj: unknown, req: FableRequest): unknown {
  if (!obj || typeof obj !== "object") return obj;
  const o = obj as Record<string, unknown>;
  o.version = 1;
  o.child_name = req.child_name;
  o.age_band = req.age_band;
  return o;
}

// ---------------------------------------------------------------------------
// One Opus call. Returns parsed+validated Fable, or null on any miss. The
// caller handles retry + demo fallback. Never throws.
// ---------------------------------------------------------------------------

async function generateOnce(
  client: Anthropic,
  req: FableRequest,
): Promise<Fable | null> {
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2200,
    // effort "low" keeps the single constrained JSON terse and fast — the
    // structure is fully specified by the system block, so we don't need deep
    // deliberation, just a warm, brief telling. Speeds the hot path.
    output_config: { effort: "low" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserPrompt(req) }],
  } as Anthropic.MessageCreateParamsNonStreaming);

  // Server-side telemetry (Vercel/dev logs only — never reaches the child).
  // Confirms prompt-cache hits keep repeat generations fast and cheap.
  try {
    const u = msg.usage as unknown as Record<string, number>;
    // eslint-disable-next-line no-console
    console.error(
      `[fable] usage in=${u.input_tokens} out=${u.output_tokens} ` +
        `cache_write=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`,
    );
  } catch {
    /* ignore */
  }

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  const parsed = parseFable(text);
  if (parsed === null) return null;

  const corrected = forceFields(parsed, req);
  coerceFable(corrected); // snap near-miss scene enums before validating
  const result = validateFable(corrected);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[fable] validation failed:", result.errors.slice(0, 8).join(" | "));
    return null;
  }

  return corrected as Fable;
}

export async function handleFableRequest(
  body: unknown,
): Promise<{ status: number; body: FableResponse }> {
  try {
    const req = normalizeRequest(body);

    // Gentle gate — never generate from non-child-appropriate input.
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // No key configured — serve the nearest demo, never crash.
      return {
        status: 200,
        body: {
          fable: pickDemo(req.situation || "sharing", req.child_name, req.age_band),
          source: "fallback",
          fallback_reason: "no_api_key",
        },
      };
    }

    const client = new Anthropic({ apiKey, maxRetries: 1 });

    // ONE call; if parse/validate misses, RETRY ONCE (same params). Any thrown
    // error (network, timeout, generation) is caught and treated as a miss.
    let fable: Fable | null = null;
    let lastReason = "generation_failed";
    for (let attempt = 0; attempt < 2 && !fable; attempt++) {
      try {
        fable = await generateOnce(client, req);
        if (!fable) lastReason = "invalid_or_schema_miss";
      } catch (err) {
        lastReason = "generation_error";
        // eslint-disable-next-line no-console
        console.error(`[/api/fable] generation attempt ${attempt + 1} failed:`, err);
      }
    }

    if (fable) {
      return { status: 200, body: { fable, source: "live" } };
    }

    // Still nothing after the retry — silently fall back to the nearest demo.
    return {
      status: 200,
      body: {
        fable: pickDemo(req.situation || "sharing", req.child_name, req.age_band),
        source: "fallback",
        fallback_reason: lastReason,
      },
    };
  } catch (err) {
    // Absolute last resort — handleFableRequest must NEVER throw.
    // eslint-disable-next-line no-console
    console.error("[/api/fable] unexpected error:", err);
    return { status: 200, body: emergencyFallback(body) };
  }
}
