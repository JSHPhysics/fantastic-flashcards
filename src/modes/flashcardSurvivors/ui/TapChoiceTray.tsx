// Tap-mode answer tray (Survivors-Spec §2.6.2).
// Uses theme tokens — surface plate with ink text — so the buttons stay
// readable on every theme.

import { useEffect, useState } from "react";
import type { GameEngine } from "../engine/GameEngine";
import type { TapInput } from "../engine/TapInput";

interface TapChoiceTrayProps {
  engine: GameEngine;
  input: TapInput;
}

export function TapChoiceTray({ engine, input }: TapChoiceTrayProps) {
  const [choices, setChoices] = useState<string[] | null>(null);

  useEffect(() => {
    const listener = (event: import("../engine/types").EngineEvent) => {
      if (event.type === "tapChoices") setChoices(event.choices);
      else if (event.type === "tapCleared") setChoices(null);
    };
    engine.addEventListener(listener);
    return () => engine.removeEventListener(listener);
  }, [engine]);

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 sm:px-3">
      <div className="mx-auto max-w-xl">
        {choices ? (
          // 2×2 grid. min-h 72px on phones so each option is comfortably
          // bigger than the 44pt iOS / 48dp Android tap-target minima
          // even when the choice is a single short word. Word-break
          // wraps long French phrases.
          <div className="grid grid-cols-2 gap-2">
            {choices.map((c, i) => (
              <button
                key={`${i}-${c}`}
                type="button"
                onClick={() => input.submitChoice(c)}
                className="min-h-[72px] break-words rounded-2xl border border-ink-200 bg-surface px-3 py-3 text-base font-medium text-ink-900 shadow-md transition-colors active:bg-ink-100 hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-dark-ink dark:active:bg-dark-bg dark:hover:bg-dark-bg"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-surface/70 px-3 py-3 text-center text-xs text-ink-700 shadow-md backdrop-blur dark:border-dark-surface dark:bg-dark-surface/70 dark:text-ink-300">
            Tap an enemy to pick your answer.
          </div>
        )}
      </div>
    </div>
  );
}
