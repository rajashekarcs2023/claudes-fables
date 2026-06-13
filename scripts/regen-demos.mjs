// Regenerate the 3 pre-seeded demo fables with the LIVE claude-opus-4-8 engine,
// so the shipped demos are authentic model output (not hand-authored). Safe by
// construction: it only overwrites a demo file when the engine returns a
// genuinely LIVE, schema-valid fable (source === "live"). On anything else it
// keeps the existing hand-authored demo as the safety net.
//
// Usage: with the dev server running (npm run dev), `node scripts/regen-demos.mjs`.
// Optional base URL: BASE=http://localhost:5173 node scripts/regen-demos.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const BASE = process.env.BASE || "http://localhost:5173";

// key (demo file) -> the canonical hero name + a situation that routes to it.
// Canonical names MUST match src/lib/demos.ts so name-substitution still works.
const TARGETS = [
  { key: "sharing", name: "Maya", age: "4-6", situation: "she won't share her toys with her little brother" },
  { key: "fear-of-dark", name: "Sam", age: "4-6", situation: "he's scared of the dark at bedtime" },
  { key: "honesty", name: "Ravi", age: "4-6", situation: "he broke something and is afraid to tell the truth" },
];

async function regen() {
  for (const t of TARGETS) {
    const file = join(root, "demo", `${t.key}.json`);
    try {
      const res = await fetch(`${BASE}/api/fable`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ situation: t.situation, child_name: t.name, age_band: t.age }),
      });
      const data = await res.json();
      if (data && data.source === "live" && data.fable && data.fable.fork) {
        // sanity: choice ids must equal branch keys (the engine already validated)
        const ids = data.fable.fork.choices.map((c) => c.id).sort().join(",");
        const keys = Object.keys(data.fable.branches).sort().join(",");
        if (ids === keys) {
          writeFileSync(file, JSON.stringify(data.fable, null, 2) + "\n", "utf8");
          console.log(`✓ ${t.key}: regenerated LIVE -> "${data.fable.title}"`);
          continue;
        }
      }
      console.log(`• ${t.key}: kept hand-authored demo (engine returned source="${data?.source}")`);
    } catch (e) {
      console.log(`• ${t.key}: kept hand-authored demo (error: ${e instanceof Error ? e.message : e})`);
    }
  }
  // confirm all three still parse
  for (const t of TARGETS) {
    JSON.parse(readFileSync(join(root, "demo", `${t.key}.json`), "utf8"));
  }
  console.log("All 3 demo files valid JSON.");
}

regen();
