# Claude's Fables — project brief (read fully before writing any code)

This file is the source of truth. If anything you generate conflicts with it, this file wins. Do not redesign, rename, or "improve" the concept. Build exactly this.

## What Claude's Fables is
A bedtime app where a parent names a real thing their child is facing ("she won't share", "he's scared of the dark"), and the app generates a short **interactive fable** in which the child is the hero and **makes the moral choice themselves**. The lesson lands through the consequence of their choice, never through a narrator lecturing. It ends by handing the parent one line to talk about together.

One-sentence pitch: *a child who can't type or read designs the outcome of their own fable, and the lesson lands through their own hands.*

Display name on screen: **Claude's Fables**. Use the provided `logo.svg` as the warm title art on the opening (grown-up) screen — don't typeset the name plainly.

## The locked experience (the only loop, in order)
1. **Grown-up's 10 seconds** — prompt "What's on your child's heart tonight?", quick-pick chips (Sharing · Honesty · Fear of the dark · Bravery · Kindness · New sibling · Saying sorry) + a free text/voice field. Also collect the child's first name.
2. **Conjure** — warm transition ("Weaving a tale just for {name}…") while the fable is generated.
3. **Setup scenes** — 1–2 illustrated, voice-narrated scenes casting the child by name as the hero, building to the fork.
4. **The fork** — the child, as the hero, faces the real moral choice. Two large illustrated choice cards, equal visual weight (NO nudging toward the "right" one). Tap is primary; voice is a stretch.
5. **Consequence, not lecture** — the story branches and SHOWS the outcome. Warm for the prosocial choice; gentle and never punishing for the other. Optional (stretch): offer "what else could the crow have done?" so the child reasons their way back.
6. **Parent bridge** — a closing card hands the grown-up one conversation line ("Ask {name} why the crow felt warmer after sharing"). This is the most important screen for impact. Never skip it.

## Architecture — two layers, do not mix them
### Build-time orchestration (how you, Claude Code, construct this)
Use a **dynamic workflow** with subagents in isolated contexts to avoid goal drift:
- fan-out: separate subagents build the scene renderer, the fable-engine API route, the kid UI, the grown-up UI, and the studio panel.
- adversarial verification: a **separate** verifier subagent grades the built app against `rubric.md` (do not let the builder grade itself — self-preferential bias).
- loop-until-done against `rubric.md` part A, bounded by a token budget.
See `BUILD_PROMPT.md` for the exact kickoff.

### Runtime (what the deployed app does) — optimize for SPEED
The kid's hot path is **one** Opus 4.8 call, nothing more:
- `POST /api/fable` takes `{ situation, child_name, age_band }` and returns one JSON object matching the schema below.
- Do NOT try to parse partial/streamed JSON — that's a rabbit hole. Buffer the full response, validate it against the schema, then render. The 3–5s wait is covered by the warm "conjuring" animation (drifting stars), so the wait feels like magic, not lag.
- JSON robustness: instruct the model to return strict JSON only. On the server, strip any code fences, parse, and validate. On invalid JSON or a schema miss, retry once; if it still fails, FALL BACK to the closest pre-seeded demo fable rather than erroring.
- Resilience (this saves the live demo): on ANY failure — network, timeout, generation error, Guardian fails twice — never show an error screen to a child. Silently fall back to a pre-seeded fable that matches the chosen situation, or the nearest one. A blank or error screen on stage is the only true failure.
- The Guardian self-check fields are filled **in the same generation** (fast). A second, visible Guardian pass is OPTIONAL and only for the studio panel / demo — it must never block what the child sees.
- Enable prompt caching on the system block (skills + schema + exemplar) so repeat generations are fast and cheap.
- Pre-generate and ship 3 demo fables (sharing, fear-of-dark, honesty) as static JSON so the demo's hero example is instant and reliable, and so they double as the fallback library; still support live arbitrary situations.
- If the parent's input isn't child-appropriate, don't generate — gently return "let's pick something for {name}" and the chips.

## Tech stack (use exactly this; don't substitute)
- Vite + React + TypeScript.
- Plain CSS or a single small CSS file. No heavy UI kit.
- Anthropic SDK on a server route (Vercel serverless function or a tiny Express server). API key in `ANTHROPIC_API_KEY` env var — read server-side only, never in client code. Keep it in `.env` locally and ensure `.env` is gitignored before the first push (the repo is public — a committed key gets scraped fast); set the key in the Vercel dashboard for production.
- Model: `claude-opus-4-8` for fable generation. Guardian may use `claude-opus-4-8` (preferred for the "Opus 4.8 use" score) or `claude-haiku-4-5-20251001` only if latency forces it.
- Narration: browser Web Speech API (`speechSynthesis`). No external TTS service. Pick the warmest available voice, rate ~0.9, with pauses between scenes. The FIRST narration must be triggered by the parent's "start" tap (browsers block autoplay audio before a user gesture) — never rely on speaking on page load.
- Layout: mobile-first and responsive — a single centered portrait column (~max-width 480px) that feels like a bedtime app on a phone and stays centered/contained on desktop (never sprawl full-width).
- Deploy: Vercel — Vite preset plus an `/api/fable` serverless function that holds `ANTHROPIC_API_KEY` (set it in the Vercel dashboard, never in the repo). Deploy a stub to a live URL within the first 15 minutes and push continuously — never deploy for the first time at the end.

## File tree (create this shape)
```
/src
  /scene        Scene.tsx        # renders a scene-spec -> flat SVG (the motif library)
  /server       fable.ts         # POST /api/fable: one Opus call, returns fable JSON
                guardian.ts      # optional visible 2nd-pass check
  /ui           GrownupAsk.tsx   # step 1
                Story.tsx        # steps 3-6: scenes, fork, branches, parent bridge
                StudioPanel.tsx  # judge-facing: shows the agents + a Guardian catch
  /prompts      fable-author.md  # = the fable-author skill body (single source of truth)
                storybook-art.md # = the storybook-art skill body
                guardian.md      # = the child-guardian skill body
                tender-ui.md     # = the tender-ui skill body (the app's warmth + feel)
                character-design.md # = the character-design skill body (how to draw the animals)
  App.tsx  main.tsx  types.ts
/demo           sharing.json fear-of-dark.json honesty.json   # pre-seeded fables
rubric.md  CLAUDE.md
```
The `/prompts/*.md` files are copied verbatim from the matching `.claude/skills/*/SKILL.md` bodies so build-time and runtime share one source of truth.

## The fable contract (the model MUST return exactly this; renderer depends on it)
```jsonc
{
  "version": 1,
  "title": "Maya and the last loaf",
  "child_name": "Maya",
  "age_band": "4-6",                       // "4-6" | "7-9"
  "lesson_id": "sharing",
  "lesson_one_line": "Sharing can turn a lonely moment into a friend.",
  "setup_scenes": [
    { "narration": "string, <= 2 sentences", "scene": { /* scene-spec */ } }
  ],
  "fork": {
    "prompt": "What does {name} do?",
    "narration": "string",
    "scene": { /* scene-spec */ },
    "choices": [
      { "id": "share", "label": "Share the bread", "scene": { /* mini scene-spec */ } },
      { "id": "keep",  "label": "Keep it for myself", "scene": { /* mini scene-spec */ } }
    ]
  },
  "branches": {
    "share": { "scenes": [ { "narration": "...", "scene": {} } ], "tone": "warm",   "ending": "..." },
    "keep":  { "scenes": [ { "narration": "...", "scene": {} } ], "tone": "gentle", "ending": "...",
               "explore_offer": "What else could the crow have done?" }  // optional
  },
  "parent_bridge": { "talk_prompt": "Ask Maya why the crow felt warmer after sharing.",
                     "lesson_recap": "Tonight's story was about sharing." },
  "guardian": { "passed": true, "age_appropriate": true, "no_preaching": true,
                "no_scary_or_punitive": true, "notes": "" }
}
```
The two `choices[].id` values must match the two keys in `branches`. Keep narration short — these are read aloud to a small child.

### scene-spec (constrained — the renderer only knows these enums)
```jsonc
{
  "setting": "night_branch",     // see storybook-art skill for the allowed list
  "props": ["moon", "stars"],
  "characters": [
    { "type": "crow", "size": "big",   "holding": "bread", "pose": "perched" },
    { "type": "crow", "size": "small", "holding": null,    "pose": "looking_up" }
  ],
  "mood": "tender"
}
```
The model picks ONLY from the enums defined in the storybook-art skill. If it needs a motif that doesn't exist, it must pick the closest existing one — never invent free-form SVG on the hot path.

## Non-negotiables (do not deviate)
- The child makes the choice. No "correct answer" highlighting, no scores, no win/lose, no stars/coins.
- No lecturing. The lesson is shown through consequence. The Guardian rejects any preachy or moralizing narration.
- The "other" choice is never punished harshly or made scary. Gentle truth only.
- Voice narration is mandatory (the child may not read).
- The parent bridge always renders at the end.
- Nothing scary, violent, or sad-beyond-gentle for the youngest band.
- It is a single finishable story, not an endless feed.

## Scope
- MUST: steps 1–6 working end to end, the one streaming generation, the scene renderer with the starter motif set, narration, the studio panel showing at least one Guardian catch, 3 pre-seeded demos, deployed public URL.
- STRETCH (only if green and time remains), best first:
  - **Child picks their hero** — after the grown-up's input, show the child a "Choose your hero, {name}!" screen with 3–4 big animal cards (crow, fox, little bird, rabbit) drawn by the scene renderer. One tap. Pass the choice as `hero` to `/api/fable`; the fable-author casts that animal as the hero instead of choosing its own. No new art (renderer already draws them), no new infra. This is the child's first act of authorship — promote it toward core if time allows.
  - kid voice input, the "explore" branch, a second age band, multi-language.

## Built to scale (keep these seams clean)
- New lessons = data, not code (just new situations → the model maps to `lesson_id`).
- New art = add a motif to the storybook-art enum + a case in `Scene.tsx`. Nothing else changes.
- Per-child memory, sibling co-op mode, printable keepsake, and translation are all additive on top of the same schema. Don't build them now; don't block them either.

## Using the skills
Five skills under `.claude/skills/` define the fable author, the art motif library, the Guardian, the app's warmth/feel (tender-ui), and how to hand-draw the characters (character-design). Load and follow all five. Their bodies are the runtime prompts and design rules (copied into `/src/prompts/`). The tender-ui skill is mandatory, not decoration — it is how the app earns "warm and loving." The character-design skill is build-time craft for `Scene.tsx` — hand-author the animals once in that house style; never generate character SVG on the hot path.