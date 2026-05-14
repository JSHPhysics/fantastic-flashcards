// End-of-run summary + Insight breakdown (Survivors-Spec §2.10 / §2.9).
// Uses theme tokens so the screen adopts the active theme's surface +
// ink palette. The scrim stays bg-black/70 so the surface card stands
// out regardless of theme.

import type { RunSummary } from "../engine/types";
import { getWeaponDef } from "../weapons/registry";
import { DIFFICULTIES } from "../engine/difficulty";

interface GameOverScreenProps {
  summary: RunSummary;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function GameOverScreen({ summary, onPlayAgain, onExit }: GameOverScreenProps) {
  const m = Math.floor(summary.durationMs / 60_000);
  const s = Math.floor((summary.durationMs % 60_000) / 1000);
  const dCfg = DIFFICULTIES[summary.difficulty];
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur">
      <div className="w-full max-w-xl rounded-2xl bg-surface p-6 text-ink-900 shadow-xl dark:text-dark-ink">
        <h2 className="text-center text-2xl font-semibold">
          {summary.cause === "quit" ? "Run ended" : "Game over"}
        </h2>
        <p className="mt-1 text-center text-xs text-ink-500 dark:text-ink-300">
          {summary.difficulty.toUpperCase()} · {summary.inputMode}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-ink-500 dark:text-ink-300">Time survived</dt>
          <dd className="text-right">
            {m}m {s.toString().padStart(2, "0")}s
          </dd>
          <dt className="text-ink-500 dark:text-ink-300">Cards killed</dt>
          <dd className="text-right">{summary.cardsKilled}</dd>
          <dt className="text-ink-500 dark:text-ink-300">Best streak</dt>
          <dd className="text-right">{summary.bestStreak}</dd>
          <dt className="text-ink-500 dark:text-ink-300">Final level</dt>
          <dd className="text-right">{summary.finalLevel}</dd>
        </dl>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Weapons
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {summary.weapons.map((w) => {
              const def = getWeaponDef(w.id);
              return (
                <li
                  key={w.id}
                  className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-900 dark:bg-dark-bg dark:text-dark-ink"
                >
                  {def?.name ?? w.id} · L{w.level}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-5 rounded-xl bg-gold/20 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-gold">Insight earned</p>
          <p className="mt-0.5 text-3xl font-semibold text-ink-900 dark:text-dark-ink">
            +{summary.insightEarned}
          </p>
          <p className="mt-1 text-[11px] text-ink-700 dark:text-ink-300">
            Difficulty ×{dCfg.insightMult} · spend it in the Mastery Tree.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="tap-target rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onExit}
            className="tap-target rounded-xl border border-ink-300 bg-surface px-5 text-sm font-semibold text-ink-900 hover:bg-ink-100 dark:border-dark-surface dark:text-dark-ink dark:hover:bg-dark-surface"
          >
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
