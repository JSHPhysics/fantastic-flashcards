// Level-up modal (Survivors-Spec §2.10).
// Three upgrade choices, keyboard-pickable (1/2/3 + R to reroll if the
// "Reroll Insight" mastery is unlocked).
//
// Uses theme tokens — `bg-surface` modal on a `bg-black/60` scrim that
// reads correctly against every theme. Body text is `text-ink-900` so
// dark themes (Midnight, Volcanic) and light themes (Cherry Blossom,
// Slate) both render readable text.

import { useEffect, useState } from "react";
import type { UpgradeChoice } from "../upgrades/pool";
import type { GameEngine } from "../engine/GameEngine";

interface LevelUpModalProps {
  engine: GameEngine;
  choices: UpgradeChoice[];
  onClose: () => void;
}

export function LevelUpModal({ engine, choices: initial, onClose }: LevelUpModalProps) {
  const [choices, setChoices] = useState(initial);
  const [rerolls, setRerolls] = useState(engine.rerollsRemaining());

  const pick = (c: UpgradeChoice) => {
    engine.applyUpgrade(c);
    onClose();
  };
  const reroll = () => {
    if (rerolls <= 0) return;
    const next = engine.rerollLevelUp();
    setChoices(next);
    setRerolls(engine.rerollsRemaining());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const idx = Number.parseInt(e.key, 10) - 1;
        if (choices[idx]) pick(choices[idx]);
      } else if (e.key.toLowerCase() === "r") {
        reroll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, rerolls]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-3xl px-3">
        <h2 className="text-center text-2xl font-semibold text-cream drop-shadow-lg dark:text-dark-ink">
          Level up — pick one
        </h2>
        <p className="mt-1 text-center text-xs text-cream/80 dark:text-dark-ink/80">
          Keyboard: 1 / 2 / 3 to pick{rerolls > 0 ? ` · R to reroll (${rerolls} left)` : ""}.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {choices.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c)}
              className="flex h-full flex-col rounded-2xl border-2 border-ink-100 bg-surface p-4 text-left text-ink-900 shadow-xl transition-colors hover:border-gold dark:border-dark-surface dark:text-dark-ink"
            >
              <span className="text-xs text-gold">
                {c.category.replace("-", " ").toUpperCase()} · {i + 1}
              </span>
              <span className="mt-1 text-base font-semibold">{c.title}</span>
              {c.tags && c.tags.length > 0 && (
                // Tag chips on weapon cards. Pairing these with any
                // `+10% <tag> damage` upgrade picked on later level-ups
                // is the synergy the player can plan around — surfacing
                // them as a separate row makes that planning visible
                // instead of buried in the description.
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <li
                      key={t}
                      className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-navy dark:bg-gold/15 dark:text-gold"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-2 flex-1 text-xs leading-snug text-ink-700 dark:text-ink-300">
                {c.description}
              </span>
            </button>
          ))}
        </div>
        {rerolls > 0 && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={reroll}
              className="rounded-md bg-surface/85 px-3 py-1 text-xs text-ink-900 shadow-md hover:bg-surface dark:text-dark-ink"
            >
              Reroll ({rerolls})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
