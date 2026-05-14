// Keyboard-mode answer input (Survivors-Spec §2.6.1). Anchored centre-
// bottom, always focused so typing flows immediately into the game.

import { useEffect, useRef } from "react";
import type { KeyboardInput } from "../engine/KeyboardInput";

interface TypingInputProps {
  input: KeyboardInput;
}

export function TypingInput({ input }: TypingInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  // Keep focus pinned even if the user clicks the canvas.
  useEffect(() => {
    const focus = () => ref.current?.focus();
    focus();
    const onClick = () => focus();
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-3">
      <input
        ref={ref}
        type="text"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => input.setBuffer(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (input.getBuffer().length > 0) input.submitWithNoMatch();
          }
        }}
        placeholder="Type the answer…"
        className="w-full rounded-2xl border border-white/20 bg-black/55 px-4 py-3 text-center text-base text-cream placeholder:text-ink-300 backdrop-blur focus:border-gold focus:outline-none"
      />
    </div>
  );
}
