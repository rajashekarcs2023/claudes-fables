---
name: character-design
description: Use at build time when hand-authoring the animal character SVG in Scene.tsx for Claude's Fables. Defines the cozy storybook house style and a concrete construction recipe for each hero animal (crow, fox, little bird, rabbit, child) and each pose, so characters render as consistent, charming flat SVG. This is build-time vector craft — NOT runtime image generation and NOT free-form SVG on the hot path.
---

# character-design

Claude draws characters as flat SVG, hand-built once into `Scene.tsx` as reusable components. The goal: every animal looks like it belongs in the same warm bedtime book. Consistency beats detail — a few simple shapes, drawn the same way every time.

## House style
- Flat fills only. No gradients, no shadows, no outlines except the warm beak/nose accent.
- Cozy proportions: an oversized round head relative to a small soft body reads as gentle and cute. Keep everything rounded — no sharp corners.
- One construction grammar shared by all animals: body = ellipse, head = circle sitting high and slightly forward, a single cream eye-dot (`#FDF6E3`), short rounded limbs, an amber face accent (`#E0A458`). Same eye, same limb feel, same line philosophy across every character.
- Must read clearly at small size on the night-blue background (`#1f2a4d`).

## Per-animal recipe (body color in parentheses)
- **crow** (`#232a42` body, `#2e3656` wing): body ellipse, an overlapping wing ellipse, head circle, amber triangle beak, cream eye-dot, two thin legs. (This is the proven style from the logo/mockup — match it.)
- **fox** (`#C8863B` body, `#E0A458` belly/tail-tip): same body+head, two small triangle ears, a pointed amber-tipped tail as a curved shape, tiny dark nose, cream eye-dot.
- **little bird** (`#85B7EB` body): smaller and rounder, stubby wing, tiny amber beak, one cream eye-dot — about 70% of crow scale.
- **rabbit** (`#D3D1C7` body): round body+head, two long rounded ear ovals, a tiny round tail, small pink-ish nose (`#ED93B1`), cream eye-dot.
- **child** (keep abstract): a simple rounded figure — circle head, soft rounded-rectangle body in a warm tone, no facial detail beyond a gentle eye-dot and a small smile curve. Deliberately non-specific (never resembles a particular real child).

## Poses (transform the same base, don't redraw)
- `perched`: legs resting on a branch/edge line.
- `looking_up`: head tilted up, eye and beak/nose raised; a hopeful read.
- `offering`: one wing/paw extended toward the held object (use for the "share" branch).
- `curled`: body curved protectively around the held object (use for the "keep" branch).
- `walking`: legs offset front/back.
- `reaching`: a limb extended upward.

## Consistency rules
- `size: "big"` vs `"small"` = scale the whole construction ~1.5×; never change the recipe.
- `mood` shifts only light/tint, never the character's form, and never adds anything frightening.
- An unknown animal or pose falls back to the closest defined one — never a blank or a crash.
- If you're tempted to add detail (feathers, fur texture, fingers), don't. Simple and consistent is the charm.