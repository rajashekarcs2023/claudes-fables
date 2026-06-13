// PLACEHOLDER scene renderer — replaced by the scene-renderer module with the
// full hand-built motif library (settings, props, every animal x pose) per the
// storybook-art + character-design skills. This minimal version keeps the build
// green and the loop runnable. Contract: <Scene spec={SceneSpec} className? />.

import type { SceneSpec, Character } from "../types";

const PALETTE = {
  night: "#1f2a4d",
  moon: "#F4E6C1",
  stars: "#FDF6E3",
  earth: "#3a2c1f",
  foliage: "#2e4a3a",
  crow: "#232a42",
  wing: "#2e3656",
  amber: "#E0A458",
  eye: "#FDF6E3",
};

const BODY: Record<string, string> = {
  crow: "#232a42",
  little_bird: "#85B7EB",
  fox: "#C8863B",
  rabbit: "#D3D1C7",
  child: "#E0A458",
};

function CharacterGlyph({ c, x }: { c: Character; x: number }) {
  const scale = c.size === "big" ? 1.5 : 1;
  const fill = BODY[c.type] || PALETTE.crow;
  return (
    <g transform={`translate(${x} 150) scale(${scale})`}>
      <ellipse cx="0" cy="14" rx="22" ry="16" fill={fill} />
      <circle cx="-12" cy="-2" r="13" fill={fill} />
      <path d="M-24 -4 l-11 3 l11 4 z" fill={PALETTE.amber} />
      <circle cx="-14" cy="-4" r="2.8" fill={PALETTE.eye} />
      {c.holding === "bread" && <ellipse cx="6" cy="16" rx="9" ry="6" fill={PALETTE.amber} />}
      {c.holding === "lantern" && <circle cx="14" cy="18" r="7" fill={PALETTE.amber} />}
    </g>
  );
}

export default function Scene({ spec, className }: { spec: SceneSpec; className?: string }) {
  const chars = spec.characters || [];
  return (
    <svg
      className={className}
      viewBox="0 0 320 220"
      width="100%"
      role="img"
      aria-label={`A storybook scene set in ${spec.setting}`}
      style={{ display: "block", borderRadius: 18 }}
    >
      <rect x="0" y="0" width="320" height="220" fill={PALETTE.night} rx="18" />
      {spec.props?.includes("moon") && (
        <>
          <circle cx="252" cy="52" r="26" fill={PALETTE.moon} />
          <circle cx="242" cy="46" r="22" fill={PALETTE.night} />
        </>
      )}
      {spec.props?.includes("stars") &&
        [40, 90, 150, 200, 280].map((sx, i) => (
          <circle key={i} cx={sx} cy={30 + (i % 3) * 14} r="2" fill={PALETTE.stars} />
        ))}
      <path d="M0 178 Q160 168 320 178 L320 220 L0 220 Z" fill={PALETTE.earth} opacity="0.85" />
      {chars.map((c, i) => (
        <CharacterGlyph key={i} c={c} x={chars.length === 1 ? 160 : 110 + i * 100} />
      ))}
    </svg>
  );
}
