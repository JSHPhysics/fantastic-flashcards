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
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
      <div className="mx-auto max-w-xl">
        {choices ? (
          <div className="grid grid-cols-2 gap-2">
            {choices.map((c, i) => (
              <button
                key={`${i}-${c}`}
                type="button"
                onClick={() => input.submitChoice(c)}
                className="min-h-[64px] rounded-2xl border border-ink-200 bg-surface px-3 py-3 text-base text-ink-900 shadow-md transition-colors hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-dark-ink dark:hover:bg-dark-bg"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink-300 bg-surface/70 p-4 text-center text-sm text-ink-700 shadow-md backdrop-blur dark:border-dark-surface dark:bg-dark-surface/70 dark:text-ink-300">
            Tap an enemy to select it, then pick the correct answer here —
            or just type the answer.
          </div>
        )}
      </div>
    </div>
  );
}
