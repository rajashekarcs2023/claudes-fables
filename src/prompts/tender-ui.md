# tender-ui

The feeling, in one line: *being read to under a warm lamp.* Unhurried, soft, a little magical. Every screen should lower a child's heart rate, not raise it. If a choice would make the app more stimulating, more clever, or more "engaging," it is probably wrong here.

## Light and color
- Bathe the whole app in warm amber and deep night-blue (palette in the storybook-art skill). Never clinical white, never bright/neon, never high-saturation.
- Soft contrast, but always readable. Dim, cozy, lamplit — not dark-and-cold.

## Typography
- Large, rounded, friendly. Narration in a storybook serif (`--font-serif`); UI in a soft sans.
- Generous line spacing and margins. Sentence case everywhere. Minimal on-screen text for the child — the audio carries the story.

## Motion (mandatory — default cuts feel clinical)
- Everything eases. Cross-fade between scenes (250–500ms), never snap or slide hard.
- Choice cards rest with a barely-there breathing scale; on press they give a soft, slow scale-down — no bounce, no flash.
- The "conjuring" wait is part of the magic: drifting stars/fireflies and the line "Weaving a tale just for {name}…", never a spinner or progress bar.
- Honor `prefers-reduced-motion`: keep fades, drop the ambient drift.

## Narration (this is the soul — get it right)
- Choose the warmest available `speechSynthesis` voice; rate ~0.9; insert a short pause between sentences and a longer one between scenes.
- A soft glowing dot shows "I'm reading to you." Let the child re-tap any scene to hear it again.
- First narration fires on the parent's start tap (autoplay is blocked before a gesture). Never assume audio plays on load.

## Microcopy (warm, second person, never corporate)
- "What's on {name}'s heart tonight?" — not "Enter a topic."
- At the fork, no praise and no grading. The story responds to the choice; it never says "good job" or "correct." There is no right-answer glow.
- The parent bridge reads like tucking-in, quiet and warm — not a call to action.

## For small hands
- Big, forgiving, well-spaced tap targets. Audio-first so a non-reader is never stuck. Two choices at the fork, never more.

## Restraint (warmth is calm, not addictive)
- No badges, streaks, points, confetti, timers, or "play again!" nagging. One finishable story, then a gentle, optional offer to make another. Calm is the product.
