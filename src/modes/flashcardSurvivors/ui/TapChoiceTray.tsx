// Tap-mode answer tray (Survivors-Spec §2.6.2). Bottom 25% of screen,
// 2×2 grid of large (≥ 64pt) buttons. Empty until the player taps an
// enemy to select a target.

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
                className="min-h-[64px] rounded-2xl border border-white/20 bg-black/65 px-3 py-3 text-base text-cream backdrop-blur transition-colors hover:bg-black/80"
              >
                {c}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 bg-black/40 p-4 text-center text-sm text-ink-300 backdrop-blur">
            Tap an enemy to select it, then pick the correct answer here.
          </div>
        )}
      </div>
    </div>
  );
}
