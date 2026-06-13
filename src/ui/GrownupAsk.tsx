// Step 1 — the grown-up's 10 seconds.
// A warm, unhurried screen: title art, the one prompt, seven quick-pick chips
// plus a free-text field, the child's first name, an age-band toggle, and the
// primary "Begin {name}'s fable" button. A discreet ready-made row gives the
// live demo a reliable instant-load path.
//
// CONTRACT (do not change):
//   onStart(req)               -> live generation
//   onInstant(key, name, band) -> instant pre-seeded demo
//   notice?                    -> gentle amber message (e.g. blocked input)

import { useState } from "react";
import type { AgeBand, FableRequest } from "../types";

// The seven canonical situations. `value` is the natural-language phrasing
// handed to the fable author; `label` is what the grown-up reads.
const CHIPS: { label: string; value: string }[] = [
  { label: "Sharing", value: "sharing" },
  { label: "Honesty", value: "honesty" },
  { label: "Fear of the dark", value: "fear of the dark" },
  { label: "Bravery", value: "bravery" },
  { label: "Kindness", value: "kindness" },
  { label: "New sibling", value: "a new sibling" },
  { label: "Saying sorry", value: "saying sorry" },
];

// The three pre-seeded tales — also the fallback library. Keys must match the
// demo JSON filenames the server ships.
const READY_MADE: { key: string; label: string }[] = [
  { key: "sharing", label: "Sharing" },
  { key: "fear-of-dark", label: "The dark" },
  { key: "honesty", label: "Honesty" },
];

// Gentle default so the ready-made tales never load nameless on the demo.
const DEFAULT_NAME = "Maya";

// "Maya" -> "Maya's", "Thomas" -> "Thomas'".
function possessive(name: string): string {
  if (!name) return "the";
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

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

  const typed = situation.trim();
  const trimmedName = name.trim();
  // A typed value always overrides a selected chip.
  const effectiveSituation = typed || chip || "";
  const canStart = effectiveSituation.length > 0 && trimmedName.length > 0;

  function chooseChip(value: string) {
    setChip(value);
    setSituation(""); // a chip replaces any half-typed phrase
  }

  function onSituationChange(next: string) {
    setSituation(next);
    if (next.trim()) setChip(null); // typing wins over the chip
  }

  function begin() {
    if (!canStart) return;
    onStart({
      situation: effectiveSituation,
      child_name: trimmedName,
      age_band: band,
    });
  }

  return (
    <div className="stack grow fade-in" style={{ gap: 22, paddingTop: 22 }}>
      {/* ---- title art (image, never typeset) ---- */}
      <header className="stack center" style={{ gap: 12 }}>
        <img
          src="/logo.svg"
          alt="Claude's Fables"
          style={{ width: "min(300px, 80%)", height: "auto" }}
        />
        <p
          className="muted center"
          style={{ margin: 0, maxWidth: 320, lineHeight: 1.5 }}
        >
          A tiny bedtime tale where your child is the hero — and makes the choice
          themselves.
        </p>
      </header>

      {/* ---- the ask ---- */}
      <div className="surface stack" style={{ gap: 18, padding: 20 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Tonight</span>
          <h2 style={{ fontSize: "1.5rem" }}>
            What's on your child's heart tonight?
          </h2>
        </div>

        {/* quick-pick chips */}
        <div
          className="row"
          role="group"
          aria-label="A few things little hearts carry"
          style={{ flexWrap: "wrap", gap: 9 }}
        >
          {CHIPS.map((c) => {
            const active = chip === c.value && !typed;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={active}
                onClick={() => chooseChip(c.value)}
                style={{
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  padding: "11px 16px",
                  minHeight: 46,
                  borderRadius: 999,
                  color: active ? "#3a2a12" : "var(--ink-soft)",
                  background: active ? "var(--amber)" : "rgba(253,246,227,0.07)",
                  border: `1px solid ${
                    active ? "var(--amber)" : "rgba(253,246,227,0.16)"
                  }`,
                  transition:
                    "background 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease), transform 200ms var(--ease)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* free-text field — overrides a chip */}
        <input
          type="text"
          aria-label="Tell me in your own words"
          placeholder="…or tell me in your own words"
          value={situation}
          onChange={(e) => onSituationChange(e.target.value)}
        />

        {/* child's first name */}
        <label className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Their name</span>
          <input
            type="text"
            placeholder="Your child's first name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === "Enter") begin();
            }}
          />
        </label>

        {/* age band */}
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Their age</span>
          <div
            className="row"
            role="group"
            aria-label="Choose an age band"
            style={{ gap: 9 }}
          >
            {(["4-6", "7-9"] as AgeBand[]).map((b) => {
              const on = band === b;
              return (
                <button
                  key={b}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setBand(b)}
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-sans)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    padding: "12px 12px",
                    minHeight: 48,
                    borderRadius: 14,
                    color: on ? "#3a2a12" : "var(--ink-soft)",
                    background: on ? "var(--amber)" : "rgba(253,246,227,0.07)",
                    border: `1px solid ${
                      on ? "var(--amber)" : "rgba(253,246,227,0.16)"
                    }`,
                    transition:
                      "background 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease)",
                  }}
                >
                  Ages {b}
                </button>
              );
            })}
          </div>
        </div>

        {/* gentle notice (e.g. blocked input) */}
        {notice && (
          <p
            role="status"
            className="center"
            style={{
              color: "var(--amber)",
              margin: 0,
              fontSize: "0.98rem",
              lineHeight: 1.45,
            }}
          >
            {notice}
          </p>
        )}

        {/* primary action */}
        <button
          type="button"
          className="btn-primary"
          disabled={!canStart}
          onClick={begin}
        >
          Begin {possessive(trimmedName)} fable
        </button>
      </div>

      {/* ---- discreet ready-made row (reliable instant load) ---- */}
      <div className="stack center" style={{ gap: 11, paddingBottom: 6 }}>
        <span className="muted" style={{ fontSize: "0.85rem" }}>
          or open a ready-made tale
        </span>
        <div
          className="row"
          style={{ gap: 9, justifyContent: "center", flexWrap: "wrap" }}
        >
          {READY_MADE.map((d) => (
            <button
              key={d.key}
              type="button"
              className="btn-ghost"
              onClick={() => onInstant(d.key, trimmedName || DEFAULT_NAME, band)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
