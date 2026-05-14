// Always-on typed answer input (Survivors-Spec §2.6.1, plus §2.6.2 for
// Tap-mode players who have a keyboard).
//
// Uses theme tokens (`bg-surface/85` + `text-ink-900`) so the input is
// always readable against whichever palette is active.

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "../engine/GameEngine";

interface TypingInputProps {
  engine: GameEngine;
  compact?: boolean;
}

export function TypingInput({ engine, compact = false }: TypingInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const focus = () => ref.current?.focus();
    focus();
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("button, input, textarea, select, a")) return;
      focus();
    };
    document.addEventListener("click", onClick);
    // Re-focus when the engine signals it has resumed (level-up modal
    // dismissed). Without this, picking an upgrade leaves focus on the
    // (now-unmounted) upgrade button so subsequent keystrokes go nowhere
    // until the player clicks the canvas.
    const onEngineEvent = (event: import("../engine/types").EngineEvent) => {
      if (event.type === "resume") {
        // Defer one frame so the modal teardown completes first; without
        // this, focus snaps back to the button just as it unmounts.
        requestAnimationFrame(focus);
      }
    };
    engine.addEventListener(onEngineEvent);
    return () => {
      document.removeEventListener("click", onClick);
      engine.removeEventListener(onEngineEvent);
    };
  }, [engine]);

  return (
    <div
      className={`pointer-events-auto absolute left-1/2 z-20 w-full -translate-x-1/2 px-3 ${
        compact ? "bottom-44 max-w-sm" : "bottom-3 max-w-md"
      }`}
    >
      <input
        ref={ref}
        type="text"
        value={value}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          const fired = engine.tryAnswerByText(next);
          if (fired) setValue("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.length > 0) {
            engine.recordMiss();
            setValue("");
          }
        }}
        placeholder={compact ? "or just type the answer…" : "Type the answer…"}
        className="w-full rounded-2xl border border-ink-300 bg-surface/85 px-4 py-3 text-center text-base text-ink-900 placeholder:text-ink-500 shadow-md backdrop-blur focus:border-gold focus:outline-none dark:border-dark-surface dark:text-dark-ink"
      />
      <p className="mt-1 text-center text-[10px] text-cream/80 drop-shadow dark:text-dark-ink/80">
        Accents are optional — type <span className="font-mono">etre</span>{" "}
        and it'll match <span className="font-mono">être</span>.
      </p>
    </div>
  );
}
