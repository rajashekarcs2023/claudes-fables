// Strict-enough validation of a generated fable against the CLAUDE.md schema and
// the storybook-art enums. The renderer depends on this contract, so the server
// validates the FULL object before anything reaches a child. On any miss we
// retry once, then fall back to a pre-seeded demo (handled by the caller).

import type {
  Fable,
  SceneSpec,
  Setting,
  Prop,
  CharacterType,
  CharacterSize,
  Holding,
  Pose,
  Mood,
} from "../types";

const SETTINGS: Setting[] = [
  "night_branch",
  "forest_floor",
  "cozy_nest",
  "pond_edge",
  "bedroom_window",
  "open_sky",
];
const PROPS: Prop[] = [
  "moon",
  "stars",
  "lantern",
  "fireflies",
  "fallen_leaves",
  "single_flower",
];
const CHAR_TYPES: CharacterType[] = [
  "crow",
  "little_bird",
  "fox",
  "rabbit",
  "child",
];
const SIZES: CharacterSize[] = ["big", "small"];
const HOLDINGS: Holding[] = ["bread", "lantern", "flower", null];
const POSES: Pose[] = [
  "perched",
  "looking_up",
  "offering",
  "curled",
  "walking",
  "reaching",
];
const MOODS: Mood[] = ["tender", "hopeful", "lonely", "brave", "calm"];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function isStr(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function validateScene(scene: unknown, path: string, errors: string[]): void {
  if (!scene || typeof scene !== "object") {
    errors.push(`${path}: missing scene`);
    return;
  }
  const s = scene as Partial<SceneSpec>;
  if (!SETTINGS.includes(s.setting as Setting))
    errors.push(`${path}.setting invalid: ${String(s.setting)}`);
  if (!Array.isArray(s.props)) errors.push(`${path}.props must be an array`);
  else
    for (const p of s.props)
      if (!PROPS.includes(p as Prop)) errors.push(`${path}.props bad: ${String(p)}`);
  if (!MOODS.includes(s.mood as Mood))
    errors.push(`${path}.mood invalid: ${String(s.mood)}`);
  if (!Array.isArray(s.characters) || s.characters.length === 0)
    errors.push(`${path}.characters must be a non-empty array`);
  else
    s.characters.forEach((c, i) => {
      if (!CHAR_TYPES.includes(c?.type as CharacterType))
        errors.push(`${path}.characters[${i}].type invalid: ${String(c?.type)}`);
      if (!SIZES.includes(c?.size as CharacterSize))
        errors.push(`${path}.characters[${i}].size invalid: ${String(c?.size)}`);
      if (c?.holding !== undefined && !HOLDINGS.includes(c.holding as Holding))
        errors.push(`${path}.characters[${i}].holding invalid: ${String(c?.holding)}`);
      if (!POSES.includes(c?.pose as Pose))
        errors.push(`${path}.characters[${i}].pose invalid: ${String(c?.pose)}`);
    });
}

function validateNarratedScene(ns: unknown, path: string, errors: string[]): void {
  if (!ns || typeof ns !== "object") {
    errors.push(`${path}: missing`);
    return;
  }
  const n = ns as { narration?: unknown; scene?: unknown };
  if (!isStr(n.narration)) errors.push(`${path}.narration missing`);
  validateScene(n.scene, `${path}.scene`, errors);
}

export function validateFable(obj: unknown): ValidationResult {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["not an object"] };
  }
  const f = obj as Partial<Fable>;

  if (!isStr(f.title)) errors.push("title missing");
  if (!isStr(f.child_name)) errors.push("child_name missing");
  if (f.age_band !== "4-6" && f.age_band !== "7-9")
    errors.push(`age_band invalid: ${String(f.age_band)}`);
  if (!isStr(f.lesson_id)) errors.push("lesson_id missing");
  if (!isStr(f.lesson_one_line)) errors.push("lesson_one_line missing");

  if (!Array.isArray(f.setup_scenes) || f.setup_scenes.length === 0)
    errors.push("setup_scenes must be a non-empty array");
  else f.setup_scenes.forEach((ns, i) => validateNarratedScene(ns, `setup_scenes[${i}]`, errors));

  // fork
  const fork = f.fork;
  if (!fork || typeof fork !== "object") {
    errors.push("fork missing");
  } else {
    if (!isStr(fork.prompt)) errors.push("fork.prompt missing");
    if (!isStr(fork.narration)) errors.push("fork.narration missing");
    validateScene(fork.scene, "fork.scene", errors);
    if (!Array.isArray(fork.choices) || fork.choices.length !== 2)
      errors.push("fork.choices must have exactly 2 items");
    else
      fork.choices.forEach((c, i) => {
        if (!isStr(c?.id)) errors.push(`fork.choices[${i}].id missing`);
        if (!isStr(c?.label)) errors.push(`fork.choices[${i}].label missing`);
        validateScene(c?.scene, `fork.choices[${i}].scene`, errors);
      });
  }

  // branches must match the two choice ids
  const branches = f.branches;
  if (!branches || typeof branches !== "object") {
    errors.push("branches missing");
  } else if (fork && Array.isArray(fork.choices) && fork.choices.length === 2) {
    for (const c of fork.choices) {
      const b = c?.id ? branches[c.id] : undefined;
      if (!b) {
        errors.push(`branches missing key for choice id "${String(c?.id)}"`);
        continue;
      }
      if (!Array.isArray(b.scenes) || b.scenes.length === 0)
        errors.push(`branches.${c.id}.scenes must be non-empty`);
      else
        b.scenes.forEach((ns, i) =>
          validateNarratedScene(ns, `branches.${c.id}.scenes[${i}]`, errors),
        );
      if (b.tone !== "warm" && b.tone !== "gentle")
        errors.push(`branches.${c.id}.tone invalid`);
      if (!isStr(b.ending)) errors.push(`branches.${c.id}.ending missing`);
    }
  }

  // parent bridge — the most important screen
  const pb = f.parent_bridge;
  if (!pb || typeof pb !== "object") errors.push("parent_bridge missing");
  else {
    if (!isStr(pb.talk_prompt)) errors.push("parent_bridge.talk_prompt missing");
    if (!isStr(pb.lesson_recap)) errors.push("parent_bridge.lesson_recap missing");
  }

  // guardian self-report
  const g = f.guardian;
  if (!g || typeof g !== "object") errors.push("guardian missing");
  else if (typeof g.passed !== "boolean") errors.push("guardian.passed must be boolean");

  return { ok: errors.length === 0, errors };
}
