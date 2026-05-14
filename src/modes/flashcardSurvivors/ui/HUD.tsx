// Heads-up display overlay (Survivors-Spec §2.11).
// Top-left: HP bar + XP + level. Top-right: weapon slots. Top-centre:
// streak + run timer.

import { useEffect, useState } from "react";
import type { GameEngine } from "../engine/GameEngine";
import type { OwnedWeapon, PlayerStats } from "../engine/types";
import { getWeaponDef } from "../weapons/registry";

interface HUDProps {
  engine: GameEngine;
  weaponCap: number;
  onExit: () => void;
}

export function HUD({ engine, weaponCap, onExit }: HUDProps) {
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
      {/* Top-left: HP + XP + level */}
      <div className="pointer-events-auto absolute left-3 top-3 w-56 rounded-xl bg-black/55 p-2 text-cream backdrop-blur">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold">L{player.level}</span>
          <span className="flex-1 truncate text-ink-300">
            HP {Math.max(0, Math.ceil(player.hp))} / {player.maxHp}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-good transition-[width] duration-100"
            style={{ width: `${hpPct}%` }}
          />
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gold transition-[width] duration-100"
            style={{ width: `${xpPct}%` }}
          />
        </div>
      </div>

      {/* Top-centre: streak + timer */}
      <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-xl bg-black/55 px-3 py-1 text-center text-xs text-cream backdrop-blur">
        <div className="font-mono text-base">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </div>
        {player.streak > 0 && (
          <div className="mt-0.5 text-[11px] text-gold">
            Streak {player.streak}{player.streak >= 5 ? " 🔥" : ""}
          </div>
        )}
      </div>

      {/* Top-right: weapon slots + exit */}
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
        <div className="flex gap-1">
          {Array.from({ length: weaponCap }).map((_, i) => {
            const w = weapons[i];
            const def = w ? getWeaponDef(w.id) : null;
            return (
              <div
                key={i}
                title={def ? `${def.name} L${w?.level}` : "Empty slot"}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold ${
                  w
                    ? "bg-navy text-cream"
                    : "bg-white/10 text-white/40"
                }`}
              >
                {def ? def.name[0] + (w?.level ?? 1) : "·"}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-md bg-white/15 px-2 py-1 text-xs font-semibold text-cream hover:bg-white/25"
        >
          Quit
        </button>
      </div>
    </div>
  );
}
