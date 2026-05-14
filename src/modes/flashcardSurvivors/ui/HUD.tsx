// Heads-up display overlay (Survivors-Spec §2.11).
// Top-left: HP bar + XP + level. Top-right: weapon slots. Top-centre:
// streak + run timer.
//
// Uses theme tokens — `bg-surface` for plates and `text-ink-900` /
// `text-ink-700` for text. These are always-readable by the theme's
// definition (every theme defines an ink colour that contrasts with
// its surface), so the HUD adapts to Midnight, Cherry Blossom,
// Forest, etc. without invisible-text bugs.

import { useEffect, useState } from "react";
import type { GameEngine } from "../engine/GameEngine";
import type { OwnedWeapon, PlayerStats } from "../engine/types";
import { getWeaponDef } from "../weapons/registry";

interface HUDProps {
  engine: GameEngine;
  weaponCap: number;
  onExit: () => void;
  onPause: () => void;
}

export function HUD({ engine, weaponCap, onExit, onPause }: HUDProps) {
  const [player, setPlayer] = useState<PlayerStats | null>(null);
  const [weapons, setWeapons] = useState<OwnedWeapon[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const listener = (event: import("../engine/types").EngineEvent) => {
      if (event.type === "stats") {
        setPlayer(event.player);
        setWeapons(event.weapons);
      }
    };
    engine.addEventListener(listener);
    const id = window.setInterval(() => setElapsedMs(engine.tickTime()), 200);
    return () => {
      engine.removeEventListener(listener);
      window.clearInterval(id);
    };
  }, [engine]);

  if (!player) return null;

  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);
  const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
  const xpPct = Math.min(100, (player.xp / player.xpToNextLevel) * 100);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* Top-left: HP + XP + level. Narrower on phones (w-40 = 160px =
          44% of a 360px screen) so the timer in the middle isn't
          squashed; full w-56 from sm up. */}
      <div className="pointer-events-auto absolute left-2 top-2 w-40 rounded-xl bg-surface/85 p-2 text-ink-900 shadow-md backdrop-blur sm:left-3 sm:top-3 sm:w-56 dark:text-dark-ink">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold">L{player.level}</span>
          <span className="flex-1 truncate text-ink-700 dark:text-ink-300">
            HP {Math.max(0, Math.ceil(player.hp))} / {player.maxHp}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-dark-bg">
          <div
            className="h-full bg-good transition-[width] duration-100"
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-dark-bg">
          <div
            className="h-full bg-gold transition-[width] duration-100"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Top-centre: streak + timer. */}
      <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-xl bg-surface/85 px-3 py-1 text-center text-xs text-ink-900 shadow-md backdrop-blur sm:top-3 dark:text-dark-ink">
        <div className="font-mono text-base">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
        {player.streak > 0 && (
          <div className="mt-0.5 text-[11px] text-gold">
            Streak {player.streak}{player.streak >= 5 ? " 🔥" : ""}
          </div>
        )}
      </div>

      {/* Top-right: weapon slots + exit. Slot tiles drop to h-7 w-7 on
          phones so 8 of them + the Quit button fit alongside the
          timer; full h-8 w-8 from sm up. */}
      <div className="pointer-events-auto absolute right-2 top-2 flex flex-col items-end gap-1.5 sm:right-3 sm:top-3 sm:gap-2">
        <div className="flex gap-1">
          {Array.from({ length: weaponCap }).map((_, i) => {
            const w = weapons[i];
            const def = w ? getWeaponDef(w.id) : null;
            return (
              <div
                key={i}
                title={def ? `${def.name} L${w?.level}` : "Empty slot"}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold shadow-sm sm:h-8 sm:w-8 ${
                  w
                    ? "bg-navy text-cream dark:text-dark-ink"
                    : "bg-surface/60 text-ink-500"
                }`}
              >
                {def ? def.name[0] + (w?.level ?? 1) : "·"}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause (Esc or P)"
            className="tap-target rounded-md bg-surface/85 px-3 text-xs font-semibold text-ink-900 shadow-md hover:bg-surface dark:text-dark-ink"
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            onClick={onExit}
            className="tap-target rounded-md bg-surface/85 px-3 text-xs font-semibold text-ink-900 shadow-md hover:bg-surface dark:text-dark-ink"
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}
