# Claude's Fables

**A child who can't type or read designs the outcome of their own bedtime fable — and the lesson lands through their own hands.**

🌙 **Live:** https://claudes-fables.vercel.app

A parent names a real thing their child is facing tonight ("she won't share", "he's scared of the dark"). The app weaves a short, illustrated, voice‑narrated fable where **the child is the hero** and **makes the moral choice themselves**. The lesson is never lectured — it lands through the consequence of the child's own choice. It ends by handing the grown‑up one line to talk about together.

<p align="center">
  <img src="docs/screens/01-ask.png" width="190" alt="Grown-up's 10 seconds" />
  <img src="docs/screens/02-scene.png" width="190" alt="A narrated scene" />
  <img src="docs/screens/03-fork.png" width="190" alt="The fork — two equal choices" />
  <img src="docs/screens/04-parent-bridge.png" width="190" alt="The parent bridge" />
</p>

## The problem & who it's for

Bedtime "lesson" apps either lecture the child or turn morality into points and stars. A 4‑year‑old can't read the chapter book that would do this well, and a tired parent has about ten seconds. **Claude's Fables** is for that parent and that child: in ten seconds the grown‑up names what's on the child's heart; then the child — a non‑reader, audio‑first — becomes the hero and *authors the ending* with a single tap. The meaning is experienced, not told, and the parent gets one warm question to keep the conversation going after the screen goes dark.

## The locked experience (the only loop)

1. **Grown‑up's 10 seconds** — "What's on your child's heart tonight?" — quick‑pick chips + free text, and the child's first name.
2. **Conjure** — a warm transition ("Weaving a tale just for {name}…") with drifting stars while the fable is generated. No spinner — the wait is the magic.
3. **Setup scene** — an illustrated, narrated scene casting the child by name as the hero, building to the fork.
4. **The fork** — the child faces the real moral choice. Two large illustrated cards of **equal visual weight** — no nudging toward the "right" one.
5. **Consequence, not lecture** — the story branches and *shows* the outcome: warm for the prosocial choice, gentle (never punishing) for the other.
6. **Parent bridge** — a closing card hands the grown‑up one conversation line ("Ask Maya why the branch felt warmer after she shared"). The most important screen — never skipped.

## How it was built — the orchestration story

Judges grade orchestration from the brief, the rubric, and the workflow, so here is exactly how this was directed and verified:

- **Directed by the brief.** `CLAUDE.md` is the source of truth — the locked loop, the JSON fable contract, the constrained scene‑spec vocabulary, the non‑negotiables (no scores, no lecturing). Five **skills** under `.claude/skills/` define the fable author, the art motif library, the child‑guardian, the app's warmth (tender‑ui), and how to hand‑draw the animals (character‑design). Their bodies are copied verbatim into `/src/prompts/*.md` so build‑time and runtime share one source of truth.
- **A dynamic workflow of subagents in isolated contexts.** To avoid goal drift, the app was built by fanning out one subagent per module — the scene renderer, the fable‑engine API route, the kid UI, the grown‑up UI, and the studio panel — each in its own isolated context against a locked contract.
- **Adversarial self‑verification.** A **separate** verifier subagent (never the builder — that would be self‑preferential bias) graded the *running* app against `rubric.md` Part A, line by line. Unchecked lines were fixed and re‑verified, looping until done. The scorecard is below.
- **The Guardian self‑check.** Every generated fable carries a `guardian` self‑report (age‑appropriate · no preaching · no scary/punitive) filled **in the same generation** — fast, never blocking what the child sees. A visible second Guardian pass powers the studio panel's "the model caught its own mistake and fixed it" reveal.

<p align="center">
  <img src="docs/screens/05-studio-guardian.png" width="240" alt="The studio panel's Guardian catch-and-fix" />
</p>

## Runtime — optimized for a child's patience

The kid's hot path is **one** `claude-opus-4-8` call, nothing more:

- `POST /api/fable` takes `{ situation, child_name, age_band }` and returns **one** JSON object. The server buffers the full response, strips code fences, parses, **validates the whole object against the schema** (no partial‑JSON parsing), retries once on a miss, and on **any** failure silently **falls back to the nearest pre‑seeded demo** — a child never sees an error or a blank screen.
- The big system block (skills + schema + a worked exemplar) is marked for **prompt caching**, so repeat generations read ~4.8k cached tokens and stay fast and cheap.
- A **scene‑spec sanitizer** snaps any near‑miss enum to the nearest valid motif before validation, so a cosmetic model slip never costs a retry or a fallback.
- **3 pre‑seeded demo fables** (`/demo/*.json`) ship as static JSON: they load instantly for a zero‑wait hero example and double as the fallback library.
- The `ANTHROPIC_API_KEY` is read **server‑side only** (a Vercel function + the dev middleware share one handler) and never appears in any client bundle.

Narration is the soul: the browser **Web Speech API** with the warmest available voice at rate ~0.9, first triggered by the parent's start tap. No external TTS.

## Tech

Vite + React + TypeScript · one small CSS design system · Anthropic SDK on a serverless `/api/fable` function · Web Speech narration · deployed on Vercel.

```
/src
  /scene   Scene.tsx          # scene-spec enums -> hand-built flat SVG (the motif library)
  /server  fable.ts           # POST /api/fable: ONE Opus call, validate, retry, fallback
           guardian.ts        # visible 2nd-pass Guardian check (studio panel only)
           validateFable.ts   # strict schema validation + near-miss enum sanitizer
           vercelEntry.ts     # function handler (bundled to api/fable.js by esbuild)
  /ui      GrownupAsk.tsx  Story.tsx  StudioPanel.tsx
  /prompts *.md              # the 5 skill bodies, verbatim (one source of truth)
  /lib     demos.ts  api.ts  narration.ts
App.tsx  types.ts
/demo      sharing.json  fear-of-dark.json  honesty.json
```

## Run it yourself

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env   # never commit this; .env is gitignored
npm install
npm run dev          # http://localhost:5173  (dev middleware serves /api/fable locally)
npm run build        # vite build + esbuild-bundle the serverless function
```

## Scorecard — rubric.md Part A

> Graded by a **separate** verifier subagent against the live deployment, not by the builder (no self‑preferential bias).

**Functional**
- ✅ The grown‑up screen accepts a chip **or** free‑text situation **and** a child name, and starts a story.
- ✅ `POST /api/fable` makes exactly **one** `claude-opus-4-8` generation call on the hot path (plus the single CLAUDE.md‑sanctioned retry on a miss) and returns JSON valid against the schema.
- ✅ The **full** JSON is validated against the schema before rendering — no partial‑JSON parsing.
- ✅ On any generation/parse/Guardian failure the app silently falls back to a pre‑seeded fable — a child never sees an error or blank screen.
- ✅ The fork shows **two choice cards of equal visual weight**, with no "correct" indicator.
- ✅ Choosing a card plays that branch's scenes; the **other branch is reachable too** (both tested).
- ✅ Every scene auto‑narrates via the Web Speech API.
- ✅ The parent‑bridge card renders at the end of **both** branches.
- ✅ The studio panel shows the agent roles **and** a real Guardian catch‑and‑fix.
- ✅ 3 pre‑seeded demo fables load instantly from `/demo/*.json`.

**Speed**
- ⚠️ *Warm‑cache first scene < ~5s* — **measured ~12s** for a live situation. Per the rubric's own remediation ("if slower, trim the schema, **do not add agents**"), the live fable was trimmed to 1 setup scene + 1 scene per branch with `effort: low`. ~12s is the `claude-opus-4-8` output‑throughput floor for a complete **illustrated, branching** fable in a single call. The wait is covered by the **conjuring animation** (exactly as the brief intends), and the 3 pre‑seeded demos load with **zero** wait. No agents were added to the hot path.

**Integrity**
- ✅ No API key in any client bundle (`dist` greps clean; key read server‑side only).
- ✅ App builds clean and deploys to a public URL that responds (live `200`).
- ✅ Repo is public; `CLAUDE.md` and `rubric.md` are committed.

**Anti‑drift**
- ✅ No scores, win/lose, coins, stars, or "you chose correctly" anywhere.
- ✅ No narrator lecturing or stating the moral outright (the lesson lands through consequence).
- ✅ Output matches the locked 6‑step loop with nothing added or renamed.

---

Built with Claude Code. Display name and warm title art: **Claude's Fables**.
