// "How to play" intro shown the first time a student starts a run, and
// re-openable any time via the Help button on the deck-select screen.
// Theme-aware, scrollable on small viewports.
//
// Mode-aware: shows the keyboard hint when the run is configured for
// Keyboard input and the tap hint for Tap input. Avoids confusing
// students with the controls they're not using.

import { useEffect } from "react";
import type { SurvivorInputMode } from "../../../db";

interface HowToPlayModalProps {
  inputMode: SurvivorInputMode;
  // True when this is being auto-opened before a run; false when the
  // student opened it from the Help button (in which case there's no
  // pending run waiting for the Start button).
  isPreRun: boolean;
  onStart: () => void;
  onClose: () => void;
}

export function HowToPlayModal({
  inputMode,
  isPreRun,
  onStart,
  onClose,
}: HowToPlayModalProps) {
  // Esc dismisses the help (returns student to whichever screen they
  // came from). For the pre-run flow, Esc is the same as Start — we
  // shouldn't trap students who want to skip the intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isPreRun) onStart();
        else onClose();
      } else if (isPreRun && e.key === "Enter") {
        e.preventDefault();
        onStart();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPreRun, onStart, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-3 py-4 backdrop-blur sm:px-4">
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-y-auto rounded-2xl bg-surface p-4 text-ink-900 shadow-xl sm:p-6 dark:text-dark-ink">
        <h2 className="text-xl font-semibold sm:text-2xl">
          How Flashcard Survivors works
        </h2>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
          A quick read — feel free to skip if you've played before.
        </p>

        <Section title="🎯 The goal">
          Your decks spawn as shapes that drift toward you. Answer each
          card before it reaches you. If shapes hit the centre, your HP
          drops. When HP runs out the run ends — but you still earn
          Insight to spend between runs.
        </Section>

        {inputMode === "keyboard" ? (
          <Section title="⌨️ How to answer (Keyboard mode)">
            Just type the answer for any visible card. As soon as your
            typing matches a card's back, that card locks in and your
            weapons fire on it. Accents are optional —{" "}
            <span className="font-mono">etre</span> matches{" "}
            <span className="font-mono">être</span>. Press Enter to
            clear what you've typed if it isn't matching.
          </Section>
        ) : (
          <Section title="👆 How to answer (Tap mode)">
            Tap a shape to select it — four answer options appear at the
            bottom. Tap the correct one. Tapping empty space clears the
            selection without penalty. Wrong answers reset your streak.
          </Section>
        )}

        <Section title="⚔️ Weapons">
          You start with Recall Cannon — it fires at whichever card you
          just answered. As you level up you pick from new weapons or
          upgrades. Every weapon has tags (kinetic, energy, summon,
          support, synergy). Pick "+x% kinetic damage"-style upgrades to
          amplify the weapons you've already got — that's the build loop.
        </Section>

        <Section title="🌳 Mastery Tree">
          Each run earns Insight points based on how long you survived
          and how hard the difficulty was. Spend Insight between runs
          in the Mastery Tree (top-left of the menu) to unlock
          permanent bonuses: bigger starting HP pool, extra weapon
          slots, faster projectiles, and so on. Bonuses apply to every
          future run.
        </Section>

        <Section title="⏸️ Pause anytime">
          Tap the ⏸ Pause button at the top-right, or press Esc / P.
          The pause screen shows every weapon you own, every tag
          bonus you've stacked, and which Mastery nodes are active —
          handy for planning your next upgrade.
        </Section>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!isPreRun && (
            <button
              type="button"
              onClick={onClose}
              className="tap-target rounded-xl border border-ink-300 bg-transparent px-4 text-sm font-semibold text-ink-900 hover:bg-ink-100 dark:border-dark-surface dark:text-dark-ink dark:hover:bg-dark-surface"
            >
              Close
            </button>
          )}
          {isPreRun && (
            <button
              type="button"
              onClick={onStart}
              className="tap-target rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
            >
              Start playing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold text-navy dark:text-gold">
        {title}
      </h3>
      <p className="mt-1 text-sm leading-snug text-ink-700 dark:text-ink-300">
        {children}
      </p>
    </section>
  );
}
