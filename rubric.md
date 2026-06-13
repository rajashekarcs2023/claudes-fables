# rubric.md — definition of done

Two rubrics. Part A is graded by the build-time **verifier subagent** (a separate agent, not the builder). Part B is graded by the runtime **Guardian** on every fable before a child sees it. A pass requires every line checked. Grade honestly; a failed line means fix, not excuse.

---

## Part A — build acceptance (verifier subagent grades the finished app)

Functional
- [ ] The grown-up screen accepts a chip OR free-text situation and a child name, and starts a story.
- [ ] `POST /api/fable` makes exactly ONE Opus 4.8 generation call on the hot path and returns JSON valid against the schema in `CLAUDE.md`.
- [ ] The full JSON is validated against the schema before rendering; the wait is covered by the conjuring animation (no partial-JSON parsing).
- [ ] On any generation/parse/Guardian failure, the app silently falls back to a pre-seeded fable — a child never sees an error or blank screen.
- [ ] The fork shows two choice cards of equal visual weight, with no "correct" indicator.
- [ ] Choosing a card plays that branch's scenes; the other branch is reachable too (test both).
- [ ] Every scene auto-narrates via the Web Speech API.
- [ ] The parent-bridge card renders at the end of both branches.
- [ ] The studio panel shows the agent roles and at least one Guardian catch-and-fix.
- [ ] 3 pre-seeded demo fables load instantly from `/demo/*.json`.

Speed
- [ ] On a warm cache, the first scene renders in under ~5 seconds for a live situation. If slower, the generation is doing too much in one pass — trim the schema, do not add agents to the hot path.

Integrity
- [ ] No API key in any client bundle (grep the build output).
- [ ] App builds clean and deploys to a public URL that responds.
- [ ] Repo is public; `CLAUDE.md` and `rubric.md` are committed.

Anti-drift (the reason for a separate verifier)
- [ ] No scores, win/lose, coins, stars, or "you chose correctly" anywhere.
- [ ] No narrator lecturing or stating the moral outright.
- [ ] Output matches the locked 6-step loop in `CLAUDE.md` with nothing added or renamed.

---

## Part B — per-fable content rubric (Guardian grades every generated fable)

Safety (any failure ⇒ regenerate)
- [ ] Age-appropriate for the stated band; no violence, death, cruelty, or genuine fear for the 4–6 band.
- [ ] No scary imagery, threats, or peril beyond the gentlest tension.
- [ ] No adult themes, no romance, no real-world danger instructions.
- [ ] The non-prosocial choice has a GENTLE consequence — disappointment or loneliness at most, never punishment, shame, or a frightening outcome.

Pedagogy (any failure ⇒ regenerate)
- [ ] The lesson is shown through what happens, not told by a narrator. No sentence states the moral directly to the child.
- [ ] Both choices are presented neutrally; the framing does not pre-judge the child.
- [ ] The child (as the hero) is the one who acts at the fork — not a side character.
- [ ] Narration is short, warm, and concrete; sentences are readable aloud to a young child.

Fit
- [ ] The fable clearly maps to the situation the grown-up entered.
- [ ] The child's name is used as the hero.
- [ ] The parent bridge gives one specific, answerable question tied to this story's choice.

Guardian output: set `guardian.passed=false` with a one-line `notes` on any failure, regenerate once, and surface the catch in the studio panel for the demo.
