// Always-on typed answer input (Survivors-Spec §2.6.1, plus a §2.6.2
// affordance for Tap-mode players who do have a keyboard).
//
// Single component that talks to the engine directly via
// `engine.tryAnswerByText` — no need to wire through a per-mode input
// strategy. Mounted in both modes:
//   - Keyboard mode: prominent at the bottom, autofocused.
//   - Tap mode: compact and slightly above the tray, also autofocused.
//
// Live-matches the buffer against on-screen enemy backs on every
// keystroke. First exact match (case + whitespace normalised) locks
// the enemy and clears the input. Enter with no match resets streak.

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
    return () => document.removeEventListener("click", onClick);
  }, []);

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
            // Enter without a live match counts as a deliberate "give up
            // on this attempt" — resets streak (modulo the Persistent
            // Recall mastery's once-per-run grace).
            engine.recordMiss();
            setValue("");
          }
        }}
        placeholder={compact ? "or just type the answer…" : "Type the answer…"}
        className="w-full rounded-2xl border border-white/20 bg-black/55 px-4 py-3 text-center text-base text-white placeholder:text-slate-400 backdrop-blur focus:border-amber-400 focus:outline-none"
      />
    </div>
  );
}
