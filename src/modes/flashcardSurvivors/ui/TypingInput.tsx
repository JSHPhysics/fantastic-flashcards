// Typed answer input (Survivors-Spec §2.6.1). Keyboard-mode only — Tap
// mode mounts the 4-choice tray instead, so iPadOS doesn't pop up the
// on-screen keyboard during a touch-driven run.
//
// Uses theme tokens (`bg-surface/85` + `text-ink-900`) so the input is
// always readable against whichever palette is active.

import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "../engine/GameEngine";

interface TypingInputProps {
  engine: GameEngine;
}

export function TypingInput({ engine }: TypingInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  // Defensive: even though FlashcardSurvivorsSession only mounts us in
  // Keyboard mode, an earlier version did mount in both modes and
  // popped the iOS keyboard up on tap-mode runs. If something
  // reintroduces that mistake, the component itself refuses to render
  // — no input element, no autofocus, no keyboard.
  const isTapMode = engine.getRunConfig().inputMode === "tap";

  useEffect(() => {
    if (isTapMode) return;
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
    // isTapMode is read once at mount; if it changed mid-component the
    // parent would have remounted us via the conditional gate already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  if (isTapMode) return null;

  return (
    <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-3">
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
        placeholder="Type the answer…"
        className="w-full rounded-2xl border border-ink-300 bg-surface/85 px-4 py-3 text-center text-base text-ink-900 placeholder:text-ink-500 shadow-md backdrop-blur focus:border-gold focus:outline-none dark:border-dark-surface dark:text-dark-ink"
      />
      <p className="mt-1 text-center text-[10px] text-cream/80 drop-shadow dark:text-dark-ink/80">
        Accents are optional — type <span className="font-mono">etre</span>{" "}
        and it'll match <span className="font-mono">être</span>.
      </p>
    </div>
  );
}
