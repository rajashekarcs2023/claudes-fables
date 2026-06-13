// Scene renderer for Claude's Fables.
// Hand-built flat-SVG motif library: every setting, prop, and animal x pose is
// drawn from a small set of reusable helpers in ONE consistent cozy house style
// (per storybook-art.md + character-design.md). Flat fills only — no gradients,
// no shadows, no filters, no raster. The model picks only from the scene-spec
// enums; this file has a case for each, and falls back to the closest known
// motif on anything unknown (never crash, never blank).
//
// EXTENSIBILITY SEAMS (search "// + NEW"):
//   - new setting  = add one case in <Backdrop>            (// + NEW SETTING)
//   - new prop     = add one case in <PropLayer>           (// + NEW PROP)
//   - new animal   = add one helper + one case in <Body>   (// + NEW ANIMAL)
//   - new pose     = add one branch in the pose transforms (// + NEW POSE)
//   - new holding  = add one case in <HeldObject>          (// + NEW HOLDING)

import type {
  SceneSpec,
  Character,
  Setting,
  Prop,
  CharacterType,
  Pose,
  Holding,
  Mood,
} from "../types";

/* ------------------------------------------------------------------ */
/* Fixed bedtime palette (hardcoded hex — these never invert).         */
/* ------------------------------------------------------------------ */
const C = {
  night: "#1f2a4d",
  moon: "#F4E6C1",
  stars: "#FDF6E3",
  earth: "#3a2c1f",
  foliage: "#2e4a3a",
  crow: "#232a42",
  wing: "#2e3656",
  eye: "#FDF6E3",
  amber: "#E0A458",
  outline: "#C8863B",
  // character body tones (character-design.md)
  fox: "#C8863B",
  foxBelly: "#E0A458",
  bird: "#85B7EB",
  rabbit: "#D3D1C7",
  rabbitNose: "#ED93B1",
  child: "#E0A458",
} as const;

/* ------------------------------------------------------------------ */
/* Mood → a gentle light tint only. Never adds anything frightening.   */
/* lonely = a touch cooler/dimmer; brave/hopeful = a touch warmer.     */
/* ------------------------------------------------------------------ */
type MoodLight = { glow: number; overlay: string | null; overlayOpacity: number };

function moodLight(mood: Mood | string): MoodLight {
  switch (mood) {
    case "tender":
      return { glow: 0.9, overlay: C.amber, overlayOpacity: 0.05 };
    case "hopeful":
      return { glow: 1, overlay: C.amber, overlayOpacity: 0.06 };
    case "brave":
      return { glow: 1, overlay: C.amber, overlayOpacity: 0.08 };
    case "calm":
      return { glow: 0.85, overlay: C.moon, overlayOpacity: 0.04 };
    case "lonely":
      // cooler + dimmer, but still soft and safe — never scary.
      return { glow: 0.7, overlay: "#2b3a63", overlayOpacity: 0.1 };
    default:
      // unknown mood → tender (safe default)
      return { glow: 0.9, overlay: C.amber, overlayOpacity: 0.05 };
  }
}

/* ================================================================== */
/* PROPS                                                               */
/* ================================================================== */

function Moon({ glow }: { glow: number }) {
  return (
    <g>
      {/* soft halo (flat fill, low opacity — not a gradient) */}
      <circle cx="252" cy="50" r="38" fill={C.moon} opacity={0.12 * glow} />
      <circle cx="252" cy="50" r="30" fill={C.moon} opacity={0.18 * glow} />
      <circle cx="252" cy="50" r="24" fill={C.moon} />
      {/* crescent bite carved with the night colour */}
      <circle cx="241" cy="44" r="20" fill={C.night} />
    </g>
  );
}

function Stars() {
  // hand-placed twinkles so they never collide with the moon
  const pts: Array<[number, number, number]> = [
    [40, 30, 2],
    [78, 58, 1.5],
    [120, 24, 2.2],
    [165, 46, 1.6],
    [196, 22, 2],
    [300, 96, 1.8],
    [285, 138, 1.5],
    [58, 96, 1.4],
  ];
  return (
    <g fill={C.stars}>
      {pts.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} opacity={0.9} />
      ))}
    </g>
  );
}

function Lantern() {
  // a small hanging lantern with a soft amber glow (flat circles)
  return (
    <g transform="translate(48 40)">
      <line x1="0" y1="-12" x2="0" y2="6" stroke={C.outline} strokeWidth="1.5" />
      <circle cx="0" cy="22" r="22" fill={C.amber} opacity="0.16" />
      <circle cx="0" cy="22" r="15" fill={C.amber} opacity="0.28" />
      <rect x="-9" y="8" width="18" height="22" rx="6" fill={C.amber} />
      <rect x="-9" y="8" width="18" height="22" rx="6" fill="none" stroke={C.outline} strokeWidth="1.5" />
      <rect x="-6" y="2" width="12" height="6" rx="3" fill={C.outline} />
    </g>
  );
}

function Fireflies() {
  const pts: Array<[number, number]> = [
    [70, 140],
    [110, 120],
    [150, 150],
    [205, 128],
    [240, 158],
    [90, 168],
  ];
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill={C.amber} opacity="0.18" />
          <circle cx={x} cy={y} r="2.4" fill={C.amber} />
        </g>
      ))}
    </g>
  );
}

function FallenLeaves() {
  // gently scattered leaves resting on the earth line
  const leaves: Array<[number, number, number]> = [
    [60, 192, -18],
    [120, 200, 12],
    [190, 194, -8],
    [250, 202, 22],
    [290, 190, -14],
  ];
  return (
    <g>
      {leaves.map(([x, y, rot], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
          <ellipse cx="0" cy="0" rx="9" ry="4.5" fill={C.outline} opacity="0.85" />
          <line x1="-9" y1="0" x2="9" y2="0" stroke={C.earth} strokeWidth="0.8" opacity="0.6" />
        </g>
      ))}
    </g>
  );
}

function SingleFlower() {
  // one small flower growing near the ground
  return (
    <g transform="translate(70 196)">
      <line x1="0" y1="0" x2="0" y2="-18" stroke={C.foliage} strokeWidth="2" />
      <ellipse cx="-5" cy="-16" rx="4" ry="2.6" fill={C.foliage} />
      <g transform="translate(0 -22)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-6"
            rx="3.4"
            ry="5"
            fill="#E8C0CE"
            transform={`rotate(${a})`}
          />
        ))}
        <circle cx="0" cy="0" r="3" fill={C.amber} />
      </g>
    </g>
  );
}

function PropLayer({ prop, glow }: { prop: Prop | string; glow: number }) {
  switch (prop) {
    case "moon":
      return <Moon glow={glow} />;
    case "stars":
      return <Stars />;
    case "lantern":
      return <Lantern />;
    case "fireflies":
      return <Fireflies />;
    case "fallen_leaves":
      return <FallenLeaves />;
    case "single_flower":
      return <SingleFlower />;
    // + NEW PROP: add a case here that returns one helper.
    default:
      // unknown prop → draw nothing rather than crash (closest = absence)
      return null;
  }
}

/* ================================================================== */
/* SETTINGS (backdrops)                                                */
/* ================================================================== */

function Backdrop({ setting }: { setting: Setting | string }) {
  switch (setting) {
    case "night_branch":
      return (
        <g>
          {/* a thick branch the characters perch on */}
          <path
            d="M-10 168 Q140 150 330 172"
            fill="none"
            stroke={C.earth}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M70 162 q14 -22 34 -26"
            fill="none"
            stroke={C.earth}
            strokeWidth="7"
            strokeLinecap="round"
          />
          {/* a little foliage tuft */}
          <ellipse cx="108" cy="132" rx="22" ry="13" fill={C.foliage} />
          <ellipse cx="86" cy="140" rx="16" ry="10" fill={C.foliage} />
        </g>
      );

    case "forest_floor":
      return (
        <g>
          <path d="M0 178 Q160 168 320 178 L320 220 L0 220 Z" fill={C.earth} />
          {/* soft tree trunks in the back */}
          <rect x="22" y="96" width="16" height="86" rx="6" fill={C.foliage} opacity="0.7" />
          <rect x="278" y="86" width="18" height="96" rx="6" fill={C.foliage} opacity="0.7" />
          <ellipse cx="30" cy="92" rx="34" ry="24" fill={C.foliage} opacity="0.55" />
          <ellipse cx="287" cy="80" rx="40" ry="28" fill={C.foliage} opacity="0.55" />
        </g>
      );

    case "cozy_nest":
      return (
        <g>
          {/* a woven nest cradle */}
          <path d="M0 184 Q160 170 320 184 L320 220 L0 220 Z" fill={C.earth} opacity="0.5" />
          <ellipse cx="160" cy="186" rx="120" ry="40" fill={C.earth} />
          <ellipse cx="160" cy="180" rx="98" ry="30" fill="#4a3826" />
          {[-78, -44, -10, 24, 58, 92].map((dx, i) => (
            <path
              key={i}
              d={`M${160 + dx} 196 q${dx > 0 ? 10 : -10} -22 ${dx > 0 ? 18 : -18} -30`}
              fill="none"
              stroke={C.outline}
              strokeWidth="2.4"
              strokeLinecap="round"
              opacity="0.7"
            />
          ))}
        </g>
      );

    case "pond_edge":
      return (
        <g>
          {/* still water with gentle ripples + a grassy bank */}
          <path d="M0 178 Q90 168 160 174 L160 220 L0 220 Z" fill={C.foliage} />
          <path d="M0 184 H320 V220 H0 Z" fill="#2c3a5e" opacity="0.85" />
          {[192, 204].map((y, i) => (
            <path
              key={i}
              d={`M180 ${y} q24 -5 48 0 t48 0`}
              fill="none"
              stroke={C.moon}
              strokeWidth="1.5"
              opacity="0.3"
            />
          ))}
          {/* a couple of reeds */}
          <line x1="150" y1="184" x2="150" y2="160" stroke={C.foliage} strokeWidth="2.4" />
          <line x1="160" y1="184" x2="162" y2="158" stroke={C.foliage} strokeWidth="2.4" />
        </g>
      );

    case "bedroom_window":
      return (
        <g>
          {/* a warm windowsill looking out on the night */}
          <rect x="40" y="22" width="240" height="150" rx="10" fill={C.night} />
          <rect
            x="40"
            y="22"
            width="240"
            height="150"
            rx="10"
            fill="none"
            stroke={C.outline}
            strokeWidth="5"
          />
          {/* window cross-bars */}
          <line x1="160" y1="22" x2="160" y2="172" stroke={C.outline} strokeWidth="4" />
          <line x1="40" y1="97" x2="280" y2="97" stroke={C.outline} strokeWidth="4" />
          {/* the sill the character rests on */}
          <rect x="28" y="172" width="264" height="18" rx="6" fill={C.earth} />
          <rect x="20" y="190" width="280" height="30" fill={C.earth} opacity="0.6" />
        </g>
      );

    case "open_sky":
      return (
        <g>
          {/* soft drifting clouds, lots of air */}
          <ellipse cx="80" cy="150" rx="46" ry="18" fill="#2b3a63" opacity="0.7" />
          <ellipse cx="110" cy="142" rx="34" ry="16" fill="#2b3a63" opacity="0.7" />
          <ellipse cx="240" cy="178" rx="56" ry="20" fill="#2b3a63" opacity="0.6" />
          <ellipse cx="210" cy="172" rx="34" ry="15" fill="#2b3a63" opacity="0.6" />
        </g>
      );

    // + NEW SETTING: add a case here returning the backdrop group.
    default:
      // unknown setting → night_branch (the canonical first scene)
      return <Backdrop setting="night_branch" />;
  }
}

/** A baseline y for where a character's "feet" rest, per setting. */
function groundFor(setting: Setting | string): number {
  switch (setting) {
    case "night_branch":
      return 168;
    case "cozy_nest":
      return 178;
    case "bedroom_window":
      return 172;
    case "pond_edge":
      return 184;
    case "open_sky":
      return 150;
    case "forest_floor":
    default:
      return 180;
  }
}

/* ================================================================== */
/* HELD OBJECTS                                                         */
/* ================================================================== */

function HeldObject({ holding }: { holding: Holding | string }) {
  // drawn in the character's local space, near the offering/curled limb.
  switch (holding) {
    case "bread":
      return (
        <g>
          <ellipse cx="0" cy="0" rx="9" ry="6.5" fill={C.amber} />
          <ellipse cx="0" cy="-1" rx="9" ry="6.5" fill="none" stroke={C.outline} strokeWidth="1.3" />
          <line x1="-4" y1="-3" x2="-2" y2="-5" stroke={C.outline} strokeWidth="1" />
          <line x1="2" y1="-3" x2="4" y2="-5" stroke={C.outline} strokeWidth="1" />
        </g>
      );
    case "lantern":
      return (
        <g>
          <circle cx="0" cy="0" r="13" fill={C.amber} opacity="0.22" />
          <rect x="-6" y="-7" width="12" height="15" rx="4" fill={C.amber} />
          <rect x="-6" y="-7" width="12" height="15" rx="4" fill="none" stroke={C.outline} strokeWidth="1.2" />
          <rect x="-4" y="-11" width="8" height="4" rx="2" fill={C.outline} />
        </g>
      );
    case "flower":
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3" ry="4.4" fill="#E8C0CE" transform={`rotate(${a})`} />
          ))}
          <circle cx="0" cy="0" r="2.6" fill={C.amber} />
        </g>
      );
    // + NEW HOLDING: add a case here.
    case null:
    default:
      return null;
  }
}

/* ================================================================== */
/* CHARACTERS                                                          */
/* ================================================================== */
//
// One construction grammar shared by every animal (character-design.md):
//   body ellipse + head circle sitting high & slightly forward + a single
//   cream eye-dot + an amber face accent + short rounded limbs.
// Poses transform the SAME base — they never redraw the body.
//
// Local coordinate convention for each character helper:
//   origin (0,0) = where the feet meet the ground. Body sits above in -y.
//   The character faces RIGHT by default; we flip with scaleX for pairs.

type PoseInfo = {
  headTilt: number; // rotation of the head group (deg), for looking_up
  legSpread: number; // horizontal offset between the two legs
  legOffset: number; // front/back stagger for walking
  limbUp: boolean; // reaching: a limb raised
  offer: boolean; // a limb extended forward toward a held object
  curl: boolean; // body curved protectively around the held object
};

function poseInfo(pose: Pose | string): PoseInfo {
  switch (pose) {
    case "looking_up":
      return { headTilt: -16, legSpread: 6, legOffset: 0, limbUp: false, offer: false, curl: false };
    case "offering":
      return { headTilt: -4, legSpread: 6, legOffset: 0, limbUp: false, offer: true, curl: false };
    case "curled":
      return { headTilt: 6, legSpread: 5, legOffset: 0, limbUp: false, offer: false, curl: true };
    case "walking":
      return { headTilt: 0, legSpread: 8, legOffset: 6, limbUp: false, offer: false, curl: false };
    case "reaching":
      return { headTilt: -10, legSpread: 6, legOffset: 0, limbUp: true, offer: false, curl: false };
    case "perched":
      return { headTilt: 0, legSpread: 6, legOffset: 0, limbUp: false, offer: false, curl: false };
    // + NEW POSE: add a branch here returning the transform knobs.
    default:
      // unknown pose → perched (the resting base)
      return { headTilt: 0, legSpread: 6, legOffset: 0, limbUp: false, offer: false, curl: false };
  }
}

/** Where a held object sits in the character's local space, per pose. */
function heldSpot(p: PoseInfo): { x: number; y: number } {
  if (p.curl) return { x: 4, y: -8 }; // tucked against the curled body
  if (p.offer) return { x: 22, y: -14 }; // out at the end of the extended limb
  return { x: 16, y: -10 }; // default: held to the side
}

/* ---- crow -------------------------------------------------------- */
function Crow({ p }: { p: PoseInfo }) {
  const bodyDx = p.curl ? -3 : 0;
  return (
    <g>
      {/* legs */}
      <line x1={-p.legSpread + p.legOffset} y1="-2" x2={-p.legSpread} y2="-14" stroke={C.crow} strokeWidth="2.4" strokeLinecap="round" />
      <line x1={p.legSpread - p.legOffset} y1="-2" x2={p.legSpread} y2="-14" stroke={C.crow} strokeWidth="2.4" strokeLinecap="round" />
      {/* body */}
      <ellipse cx={bodyDx} cy={p.curl ? -22 : -24} rx={p.curl ? 24 : 22} ry={p.curl ? 18 : 16} fill={C.crow} />
      {/* wing (overlapping) — extends forward when offering/reaching */}
      {p.offer ? (
        <path d={`M${bodyDx + 4} -26 q18 -4 30 6 q-12 8 -28 2 z`} fill={C.wing} />
      ) : p.limbUp ? (
        <path d={`M${bodyDx + 2} -30 q14 -16 8 -32 q-12 6 -16 26 z`} fill={C.wing} />
      ) : (
        <ellipse cx={bodyDx + 5} cy={p.curl ? -22 : -24} rx="13" ry={p.curl ? 14 : 11} fill={C.wing} />
      )}
      {/* head group (tilts for looking_up) */}
      <g transform={`translate(${bodyDx - 12} -38) rotate(${p.headTilt})`}>
        <circle cx="0" cy="0" r="13" fill={C.crow} />
        <path d="M-12 0 l-12 3 l12 4 z" fill={C.amber} />
        <circle cx="-3" cy="-2" r="2.8" fill={C.eye} />
      </g>
    </g>
  );
}

/* ---- fox --------------------------------------------------------- */
// + NEW ANIMAL: copy this pattern (one helper) and add a case in <Body>.
function Fox({ p }: { p: PoseInfo }) {
  const bodyDx = p.curl ? -3 : 0;
  return (
    <g>
      {/* curved tail with amber tip */}
      <path d={`M${bodyDx + 16} -22 q26 -2 30 -26 q-14 4 -22 14 q-6 6 -8 12 z`} fill={C.fox} />
      <path d={`M${bodyDx + 40} -46 q8 0 6 12 q-10 -2 -14 -6 z`} fill={C.foxBelly} />
      {/* legs */}
      <line x1={-p.legSpread + p.legOffset} y1="-2" x2={-p.legSpread} y2="-14" stroke={C.fox} strokeWidth="3" strokeLinecap="round" />
      <line x1={p.legSpread - p.legOffset} y1="-2" x2={p.legSpread} y2="-14" stroke={C.fox} strokeWidth="3" strokeLinecap="round" />
      {/* body + belly */}
      <ellipse cx={bodyDx} cy={p.curl ? -22 : -24} rx={p.curl ? 24 : 22} ry={p.curl ? 18 : 16} fill={C.fox} />
      <ellipse cx={bodyDx + 2} cy={p.curl ? -16 : -18} rx="13" ry="9" fill={C.foxBelly} />
      {/* a forward paw when offering / raised when reaching */}
      {p.offer && <ellipse cx={bodyDx + 22} cy="-14" rx="7" ry="5" fill={C.fox} />}
      {p.limbUp && <line x1={bodyDx + 6} y1="-30" x2={bodyDx + 12} y2="-50" stroke={C.fox} strokeWidth="4" strokeLinecap="round" />}
      {/* head group */}
      <g transform={`translate(${bodyDx - 12} -38) rotate(${p.headTilt})`}>
        {/* ears */}
        <path d="M-9 -9 l-3 -12 l9 6 z" fill={C.fox} />
        <path d="M5 -10 l3 -12 l-9 7 z" fill={C.fox} />
        <circle cx="0" cy="0" r="13" fill={C.fox} />
        {/* muzzle */}
        <path d="M-12 1 l-9 3 l9 4 z" fill={C.foxBelly} />
        <circle cx="-20" cy="4" r="2.2" fill={C.crow} />
        <circle cx="-3" cy="-2" r="2.8" fill={C.eye} />
      </g>
    </g>
  );
}

/* ---- little bird ------------------------------------------------- */
function LittleBird({ p }: { p: PoseInfo }) {
  // ~70% of crow scale, rounder, stubby wing.
  const bodyDx = p.curl ? -2 : 0;
  return (
    <g transform="scale(0.72)">
      <line x1={-p.legSpread + p.legOffset} y1="-2" x2={-p.legSpread} y2="-12" stroke={C.outline} strokeWidth="2.4" strokeLinecap="round" />
      <line x1={p.legSpread - p.legOffset} y1="-2" x2={p.legSpread} y2="-12" stroke={C.outline} strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx={bodyDx} cy={p.curl ? -20 : -22} rx={p.curl ? 22 : 21} ry={p.curl ? 18 : 16} fill={C.bird} />
      {p.offer ? (
        <path d={`M${bodyDx + 4} -24 q16 -2 24 8 q-12 6 -22 0 z`} fill="#6FA3DC" />
      ) : p.limbUp ? (
        <path d={`M${bodyDx} -28 q12 -14 6 -28 q-10 6 -12 22 z`} fill="#6FA3DC" />
      ) : (
        <ellipse cx={bodyDx + 4} cy={p.curl ? -20 : -22} rx="11" ry={p.curl ? 13 : 10} fill="#6FA3DC" />
      )}
      <g transform={`translate(${bodyDx - 11} -34) rotate(${p.headTilt})`}>
        <circle cx="0" cy="0" r="13" fill={C.bird} />
        <path d="M-12 0 l-9 2 l9 3 z" fill={C.amber} />
        <circle cx="-3" cy="-2" r="2.8" fill={C.eye} />
      </g>
    </g>
  );
}

/* ---- rabbit ------------------------------------------------------ */
function Rabbit({ p }: { p: PoseInfo }) {
  const bodyDx = p.curl ? -3 : 0;
  return (
    <g>
      {/* tiny round tail */}
      <circle cx={bodyDx + 18} cy="-18" r="6" fill="#EDEBE3" />
      <line x1={-p.legSpread + p.legOffset} y1="-2" x2={-p.legSpread} y2="-12" stroke={C.rabbit} strokeWidth="3.4" strokeLinecap="round" />
      <line x1={p.legSpread - p.legOffset} y1="-2" x2={p.legSpread} y2="-12" stroke={C.rabbit} strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx={bodyDx} cy={p.curl ? -22 : -24} rx={p.curl ? 24 : 21} ry={p.curl ? 18 : 17} fill={C.rabbit} />
      {p.offer && <ellipse cx={bodyDx + 20} cy="-14" rx="7" ry="5" fill={C.rabbit} />}
      {p.limbUp && <line x1={bodyDx + 4} y1="-30" x2={bodyDx + 8} y2="-50" stroke={C.rabbit} strokeWidth="5" strokeLinecap="round" />}
      <g transform={`translate(${bodyDx - 11} -40) rotate(${p.headTilt})`}>
        {/* two long ears */}
        <ellipse cx="-4" cy="-22" rx="4.5" ry="15" fill={C.rabbit} transform="rotate(-10)" />
        <ellipse cx="6" cy="-22" rx="4.5" ry="15" fill={C.rabbit} transform="rotate(10)" />
        <ellipse cx="-4" cy="-22" rx="2" ry="10" fill="#EDEBE3" transform="rotate(-10)" />
        <ellipse cx="6" cy="-22" rx="2" ry="10" fill="#EDEBE3" transform="rotate(10)" />
        <circle cx="0" cy="0" r="13" fill={C.rabbit} />
        <circle cx="-9" cy="3" r="2" fill={C.rabbitNose} />
        <circle cx="-3" cy="-2" r="2.8" fill={C.eye} />
      </g>
    </g>
  );
}

/* ---- child (deliberately abstract / non-specific) --------------- */
function Child({ p }: { p: PoseInfo }) {
  const bodyDx = p.curl ? -3 : 0;
  return (
    <g>
      {/* simple legs */}
      <line x1={-p.legSpread + p.legOffset} y1="-2" x2={-p.legSpread + 1} y2="-16" stroke={C.child} strokeWidth="4" strokeLinecap="round" />
      <line x1={p.legSpread - p.legOffset} y1="-2" x2={p.legSpread - 1} y2="-16" stroke={C.child} strokeWidth="4" strokeLinecap="round" />
      {/* soft rounded-rectangle body */}
      <rect x={bodyDx - 13} y={p.curl ? -38 : -42} width="26" height={p.curl ? 26 : 28} rx="12" fill={C.child} />
      {/* an arm — extended for offering / raised for reaching */}
      {p.offer && <line x1={bodyDx + 8} y1="-30" x2={bodyDx + 24} y2="-30" stroke={C.child} strokeWidth="4" strokeLinecap="round" />}
      {p.limbUp && <line x1={bodyDx + 8} y1="-34" x2={bodyDx + 16} y2="-54" stroke={C.child} strokeWidth="4" strokeLinecap="round" />}
      {/* head — circle, gentle eye-dot + tiny smile, no specific features */}
      <g transform={`translate(${bodyDx} -52) rotate(${p.headTilt * 0.5})`}>
        <circle cx="0" cy="0" r="13" fill={C.child} />
        <circle cx="-4" cy="-1" r="2.2" fill={C.crow} />
        <circle cx="4" cy="-1" r="2.2" fill={C.crow} />
        <path d="M-4 5 q4 4 8 0" fill="none" stroke={C.crow} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

/** Dispatch a character type → its hand-built helper. */
function Body({ type, p }: { type: CharacterType | string; p: PoseInfo }) {
  switch (type) {
    case "crow":
      return <Crow p={p} />;
    case "fox":
      return <Fox p={p} />;
    case "little_bird":
      return <LittleBird p={p} />;
    case "rabbit":
      return <Rabbit p={p} />;
    case "child":
      return <Child p={p} />;
    // + NEW ANIMAL: add a case here pointing at a new helper above.
    default:
      // unknown type → crow (the canonical hero)
      return <Crow p={p} />;
  }
}

/* ================================================================== */
/* CHARACTER PLACEMENT                                                 */
/* ================================================================== */

function PlacedCharacter({
  c,
  x,
  ground,
  faceLeft,
}: {
  c: Character;
  x: number;
  ground: number;
  faceLeft?: boolean;
}) {
  const scale = (c.size === "big" ? 1.5 : 1) * 1.05;
  const p = poseInfo(c.pose);
  const flip = faceLeft ? -1 : 1;
  const spot = heldSpot(p);
  return (
    <g transform={`translate(${x} ${ground}) scale(${flip * scale} ${scale})`}>
      <Body type={c.type} p={p} />
      {/* held object placed near the active limb; un-flipped so it reads upright */}
      {c.holding != null && (
        <g transform={`translate(${spot.x} ${spot.y}) scale(${flip} 1)`}>
          <HeldObject holding={c.holding} />
        </g>
      )}
    </g>
  );
}

/* ================================================================== */
/* SCENE                                                              */
/* ================================================================== */

export default function Scene({ spec, className }: { spec: SceneSpec; className?: string }) {
  // Defensive defaults — a malformed spec must still render something warm.
  const setting: Setting | string = spec?.setting ?? "night_branch";
  const props: Array<Prop | string> = Array.isArray(spec?.props) ? spec.props : [];
  const characters: Character[] = Array.isArray(spec?.characters) ? spec.characters : [];
  const mood: Mood | string = spec?.mood ?? "tender";
  const light = moodLight(mood);
  const ground = groundFor(setting);

  // Layout: one character centred; a pair faces each other so they don't
  // overlap (a big one offering toward a small one looking up reads naturally).
  const positions =
    characters.length <= 1 ? [160] : [108, 214];
  // In a pair, the LEFT character faces right and the RIGHT one faces left.
  const facing = characters.length <= 1 ? [false] : [false, true];

  return (
    <svg
      className={className}
      viewBox="0 0 320 220"
      width="100%"
      role="img"
      aria-label={`A storybook scene set in ${typeof setting === "string" ? setting.replace(/_/g, " ") : "a quiet place"}`}
      style={{ display: "block", borderRadius: 18 }}
    >
      {/* night sky */}
      <rect x="0" y="0" width="320" height="220" fill={C.night} rx="18" />

      {/* sky props (moon, stars, lantern, fireflies) sit behind the backdrop edge */}
      {props.includes("moon") && <PropLayer prop="moon" glow={light.glow} />}
      {props.includes("stars") && <PropLayer prop="stars" glow={light.glow} />}

      {/* setting backdrop */}
      <Backdrop setting={setting} />

      {/* ground-level + ambient props (drawn after backdrop so they rest on it) */}
      {props
        .filter((pr) => pr !== "moon" && pr !== "stars")
        .map((pr, i) => (
          <PropLayer key={`${pr}-${i}`} prop={pr} glow={light.glow} />
        ))}

      {/* characters */}
      {characters.slice(0, 2).map((c, i) => (
        <PlacedCharacter
          key={i}
          c={c}
          x={positions[i] ?? 160}
          ground={ground}
          faceLeft={facing[i]}
        />
      ))}

      {/* mood light — a single soft overlay tint (never anything scary) */}
      {light.overlay && (
        <rect
          x="0"
          y="0"
          width="320"
          height="220"
          rx="18"
          fill={light.overlay}
          opacity={light.overlayOpacity}
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
