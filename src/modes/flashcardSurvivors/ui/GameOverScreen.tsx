// End-of-run summary + Insight breakdown (Survivors-Spec §2.10 / §2.9).
// Fixed palette — see HUD.tsx for the rationale.

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
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur">
      <div className="w-full max-w-xl rounded-2xl bg-[#1E3A5F]/95 p-6 text-white shadow-xl">
        <h2 className="text-center text-2xl font-semibold">
          {summary.cause === "quit" ? "Run ended" : "Game over"}
        </h2>
        <p className="mt-1 text-center text-xs text-slate-300">
          {summary.difficulty.toUpperCase()} · {summary.inputMode}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-slate-300">Time survived</dt>
          <dd className="text-right">
            {m}m {s.toString().padStart(2, "0")}s
          </dd>
          <dt className="text-slate-300">Cards killed</dt>
          <dd className="text-right">{summary.cardsKilled}</dd>
          <dt className="text-slate-300">Best streak</dt>
          <dd className="text-right">{summary.bestStreak}</dd>
          <dt className="text-slate-300">Final level</dt>
          <dd className="text-right">{summary.finalLevel}</dd>
        </dl>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-slate-300">Weapons</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {summary.weapons.map((w) => {
              const def = getWeaponDef(w.id);
              return (
                <li
                  key={w.id}
                  className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]"
                >
                  {def?.name ?? w.id} · L{w.level}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-5 rounded-xl bg-amber-400/20 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-amber-300">Insight earned</p>
          <p className="mt-0.5 text-3xl font-semibold text-white">
            +{summary.insightEarned}
          </p>
          <p className="mt-1 text-[11px] text-slate-300">
            Difficulty ×{dCfg.insightMult} · spend it in the Mastery Tree.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="tap-target rounded-xl bg-white px-5 text-sm font-semibold text-[#1E3A5F] hover:bg-white/85"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={onExit}
            className="tap-target rounded-xl border border-white/30 bg-transparent px-5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
