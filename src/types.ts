// The fable contract. This file is the single shared source of truth for the
// shape of a fable and the scene-spec vocabulary. The renderer, the server, the
// demos, and the UI all depend on it. Keep it in lockstep with the schema in
// CLAUDE.md and the enums in the storybook-art skill.

export type AgeBand = "4-6" | "7-9";

/** scene-spec enums — these MUST match the storybook-art skill exactly. */
export type Setting =
  | "night_branch"
  | "forest_floor"
  | "cozy_nest"
  | "pond_edge"
  | "bedroom_window"
  | "open_sky";

export type Prop =
  | "moon"
  | "stars"
  | "lantern"
  | "fireflies"
  | "fallen_leaves"
  | "single_flower";

export type CharacterType = "crow" | "little_bird" | "fox" | "rabbit" | "child";
export type CharacterSize = "big" | "small";
export type Holding = "bread" | "lantern" | "flower" | null;
export type Pose =
  | "perched"
  | "looking_up"
  | "offering"
  | "curled"
  | "walking"
  | "reaching";
export type Mood = "tender" | "hopeful" | "lonely" | "brave" | "calm";

export interface Character {
  type: CharacterType;
  size: CharacterSize;
  holding?: Holding;
  pose: Pose;
}

export interface SceneSpec {
  setting: Setting;
  props: Prop[];
  characters: Character[];
  mood: Mood;
}

export interface NarratedScene {
  narration: string;
  scene: SceneSpec;
}

export interface Choice {
  id: string;
  label: string;
  scene: SceneSpec;
}

export interface Fork {
  prompt: string;
  narration: string;
  scene: SceneSpec;
  choices: Choice[];
}

export type BranchTone = "warm" | "gentle";

export interface Branch {
  scenes: NarratedScene[];
  tone: BranchTone;
  ending: string;
  /** Optional (7-9 stretch): invites the child to imagine another way. */
  explore_offer?: string;
}

export interface ParentBridge {
  talk_prompt: string;
  lesson_recap: string;
}

export interface GuardianReport {
  passed: boolean;
  age_appropriate: boolean;
  no_preaching: boolean;
  no_scary_or_punitive: boolean;
  notes: string;
}

export interface Fable {
  version: number;
  title: string;
  child_name: string;
  age_band: AgeBand;
  lesson_id: string;
  lesson_one_line: string;
  setup_scenes: NarratedScene[];
  fork: Fork;
  /** keys MUST equal the two fork.choices[].id values. */
  branches: Record<string, Branch>;
  parent_bridge: ParentBridge;
  guardian: GuardianReport;
}

/** Request body for POST /api/fable. */
export interface FableRequest {
  situation: string;
  child_name: string;
  age_band: AgeBand;
  /** Optional stretch: an animal the child chose; the author casts it as hero. */
  hero?: CharacterType;
}

/** Where the rendered fable came from — used only by the studio panel. */
export type FableSource = "live" | "demo" | "fallback";

export interface FableResponse {
  fable: Fable;
  source: FableSource;
  /** present when a live generation failed and we fell back */
  fallback_reason?: string;
  /** present when input was deemed not child-appropriate */
  blocked?: boolean;
}
