---
name: storybook-art
description: Use when emitting or rendering a scene-spec for the Claude's Fables app. Defines the constrained motif vocabulary (settings, props, characters, poses) and the fixed bedtime palette so storybook scenes render instantly as flat SVG, stay visually consistent, and scale by adding motifs rather than generating free-form art.
---

# storybook-art

Scenes are described as a small JSON `scene-spec` and drawn by `Scene.tsx` as flat SVG. The author picks only from these enums; the renderer has a case for each. This keeps the hot path fast (no SVG generation), consistent, and extensible (add a motif = add one enum value + one render case).

## scene-spec shape
```jsonc
{
  "setting": "night_branch",
  "props": ["moon", "stars"],
  "characters": [
    { "type": "crow", "size": "big" | "small", "holding": "bread" | null, "pose": "perched" }
  ],
  "mood": "tender"
}
```

## Allowed enums (starter set — extend deliberately)
- `setting`: `night_branch`, `forest_floor`, `cozy_nest`, `pond_edge`, `bedroom_window`, `open_sky`
- `props` (subset): `moon`, `stars`, `lantern`, `fireflies`, `fallen_leaves`, `single_flower`
- `character.type`: `crow`, `little_bird`, `fox`, `rabbit`, `child` (the hero may be the child or an animal stand-in)
- `character.size`: `big`, `small`
- `character.holding`: `bread`, `lantern`, `flower`, `null`
- `character.pose`: `perched`, `looking_up`, `offering`, `curled`, `walking`, `reaching`
- `mood`: `tender`, `hopeful`, `lonely`, `brave`, `calm` (tints the palette only — never changes safety)

## Fixed palette (hardcoded hex — these scenes do NOT invert in dark mode)
- night sky `#1f2a4d` · moon `#F4E6C1` · stars `#FDF6E3`
- branch/earth `#3a2c1f` · foliage `#2e4a3a`
- crow/animal body `#232a42` · wing `#2e3656` · eye `#FDF6E3`
- warm object (bread/lantern glow) `#E0A458` · outline `#C8863B`
- card surface `#FBF3E4` · card border `#EBD9BC` · card text `#5A4326`

## Style
Flat fills only — no gradients, no shadows, no raster effects. Simple rounded organic shapes. A scene = setting backdrop + props + 1–2 characters. Keep each scene legible at a glance to a 5-year-old. `mood` shifts only tint/light, never adds anything frightening.

## Rendering
`Scene.tsx` switches on `setting`, layers `props`, then draws each `character` from `type`+`size`+`pose`+`holding`. Unknown enum ⇒ fall back to the closest known motif, never crash, never blank.
