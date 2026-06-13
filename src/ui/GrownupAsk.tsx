// PLACEHOLDER step-1 screen — replaced by the grownup-ui module. Functional:
// chips + free text + child name + age band + start, plus an instant ready-made
// demo row. Contract:
//   onStart(req)            -> live generation
//   onInstant(key, name, band) -> instant pre-seeded demo
//   notice?                 -> gentle message (e.g. blocked input)

import { useState } from "react";
import type { AgeBand, FableRequest } from "../types";

const CHIPS = [
  { label: "Sharing", value: "sharing" },
  { label: "Honesty", value: "honesty" },
  { label: "Fear of the dark", value: "fear of the dark" },
  { label: "Bravery", value: "bravery" },
  { label: "Kindness", value: "kindness" },
  { label: "New sibling", value: "a new sibling" },
  { label: "Saying sorry", value: "saying sorry" },
];

const READY_MADE = [
  { key: "sharing", label: "Sharing" },
  { key: "fear-of-dark", label: "The dark" },
  { key: "honesty", label: "Honesty" },
];

export default function GrownupAsk({
  onStart,
  onInstant,
  notice,
}: {
  onStart: (req: FableRequest) => void;
  onInstant: (key: string, childName: string, ageBand: AgeBand) => void;
  notice?: string;
}) {
  const [situation, setSituation] = useState("");
  const [chip, setChip] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [band, setBand] = useState<AgeBand>("4-6");

  const effectiveSituation = situation.trim() || chip || "";
  const canStart = effectiveSituation.length > 0 && name.trim().length > 0;

  return (
    <div className="stack grow fade-in" style={{ gap: 20, paddingTop: 24 }}>
      <header className="stack center" style={{ gap: 10 }}>
        <img src="/logo.svg" alt="Claude's Fables" style={{ width: "min(300px, 78%)", height: "auto" }} />
        <p className="muted center" style={{ margin: 0, maxWidth: 320 }}>
          A tiny bedtime fable where your child is the hero — and makes the choice themselves.
        </p>
      </header>

      <div className="surface stack" style={{ gap: 16, padding: 18 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Tonight</span>
          <h2 style={{ fontSize: "1.5rem" }}>What's on your child's heart tonight?</h2>
        </div>

        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {CHIPS.map((c) => {
            const active = chip === c.value && !situation.trim();
            return (
              <button
                key={c.value}
                onClick={() => {
                  setChip(c.value);
                  setSituation("");
                }}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  padding: "10px 15px",
                  minHeight: 44,
                  borderRadius: 999,
                  color: active ? "#3a2a12" : "var(--ink-soft)",
                  background: active ? "var(--amber)" : "rgba(253,246,227,0.08)",
                  border: `1px solid ${active ? "var(--amber)" : "rgba(253,246,227,0.16)"}`,
                  transition: "all 200ms var(--ease)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <input
          type="text"
          placeholder="…or tell me in your own words"
          value={situation}
          onChange={(e) => {
            setSituation(e.target.value);
            if (e.target.value.trim()) setChip(null);
          }}
        />

        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Their name</span>
          <input
            type="text"
            placeholder="Your child's first name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoCapitalize="words"
          />
        </div>

        <div className="row" style={{ gap: 8 }}>
          {(["4-6", "7-9"] as AgeBand[]).map((b) => (
            <button
              key={b}
              onClick={() => setBand(b)}
              style={{
                flex: 1,
                fontWeight: 600,
                padding: "10px 12px",
                minHeight: 46,
                borderRadius: 14,
                color: band === b ? "#3a2a12" : "var(--ink-soft)",
                background: band === b ? "var(--amber)" : "rgba(253,246,227,0.08)",
                border: `1px solid ${band === b ? "var(--amber)" : "rgba(253,246,227,0.16)"}`,
              }}
            >
              Ages {b}
            </button>
          ))}
        </div>

        {notice && (
          <p className="center" style={{ color: "var(--amber)", margin: 0 }}>
            {notice}
          </p>
        )}

        <button
          className="btn-primary"
          disabled={!canStart}
          onClick={() =>
            onStart({ situation: effectiveSituation, child_name: name.trim(), age_band: band })
          }
        >
          Begin {name.trim() ? `${name.trim()}'s` : "the"} fable
        </button>
      </div>

      <div className="stack center" style={{ gap: 10 }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>or open a ready-made tale</span>
        <div className="row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {READY_MADE.map((d) => (
            <button
              key={d.key}
              className="btn-ghost"
              onClick={() => onInstant(d.key, name.trim() || "Maya", band)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
