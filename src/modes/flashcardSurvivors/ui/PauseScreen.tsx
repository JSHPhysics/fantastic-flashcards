// Manual pause screen. Opens when the player taps the Pause button in
// the HUD (or presses Esc / P during a run). Freezes the engine via
// engine.pause() and shows:
//   - Run summary (difficulty, input mode, elapsed time, level, streak)
//   - Equipped weapons with their levels + tag chips
//   - Accumulated tag bonuses from picked tag-upgrades
//   - Mastery nodes active for this run (run-start effects)
//
// All theme-aware. Tapping Resume calls engine.resume() and dismisses.

import { useEffect } from "react";
import type { GameEngine } from "../engine/GameEngine";
import type { OwnedWeapon, PlayerStats, Tag, TagBonus } from "../engine/types";
import { getWeaponDef } from "../weapons/registry";
import { MASTERY_NODES } from "../mastery/tree";
import { applyMasteryEffects } from "../mastery/effects";

interface PauseScreenProps {
  engine: GameEngine;
  player: PlayerStats;
  weapons: OwnedWeapon[];
  onResume: () => void;
  onQuit: () => void;
}

const ALL_TAGS: Tag[] = ["kinetic", "energy", "summon", "support", "synergy"];

export function PauseScreen({
  engine,
  player,
  weapons,
  onResume,
  onQuit,
}: PauseScreenProps) {
  // Esc / P dismisses the pause screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        onResume();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onResume]);

  const tagBonus = engine.getTagBonus();
  const masteryNodes = engine.getMasteryNodes();
  const runCfg = engine.getRunConfig();
  const masteryEffects = applyMasteryEffects(masteryNodes);
  const elapsedMs = engine.tickTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1000);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-2 py-3 backdrop-blur sm:px-4">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-surface p-4 text-ink-900 shadow-xl sm:p-6 dark:text-dark-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold sm:text-2xl">Paused</h2>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
              {runCfg.difficulty.toUpperCase()} · {runCfg.inputMode} ·{" "}
              {minutes}:{seconds.toString().padStart(2, "0")}
            </p>
          </div>
          <button
            type="button"
            onClick={onResume}
            className="tap-target rounded-xl bg-navy px-4 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
          >
            Resume
          </button>
        </div>

        {/* Quick stat row */}
        <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm sm:grid-cols-4">
          <Stat label="Level" value={String(player.level)} />
          <Stat
            label="HP"
            value={`${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`}
          />
          <Stat label="Streak" value={String(player.streak)} />
          <Stat
            label="Best streak"
            value={String(player.bestStreak)}
          />
        </dl>

        {/* Weapons */}
        <section className="mt-4">
          <SectionHeader title="Weapons" count={weapons.length} />
          {weapons.length === 0 ? (
            <p className="text-xs text-ink-500 dark:text-ink-300">
              No weapons yet — level up to pick one.
            </p>
          ) : (
            <ul className="space-y-2">
              {weapons.map((w) => {
                const def = getWeaponDef(w.id);
                if (!def) return null;
                return (
                  <li
                    key={w.id}
                    className="rounded-xl border border-ink-100 bg-cream/40 p-2 dark:border-dark-surface dark:bg-dark-bg/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {def.name}
                      </span>
                      <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy dark:bg-gold/15 dark:text-gold">
                        L{w.level} / 5
                      </span>
                    </div>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {def.tags.map((t) => (
                        <li
                          key={t}
                          className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink-700 dark:bg-dark-surface dark:text-ink-300"
                        >
                          {t}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] leading-snug text-ink-700 dark:text-ink-300">
                      {def.perLevel[w.level - 1] ?? def.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tag bonuses */}
        <section className="mt-4">
          <SectionHeader title="Tag bonuses" />
          <TagBonusGrid tagBonus={tagBonus} />
        </section>

        {/* Mastery */}
        <section className="mt-4">
          <SectionHeader
            title="Mastery this run"
            count={masteryNodes.length}
          />
          {masteryNodes.length === 0 ? (
            <p className="text-xs text-ink-500 dark:text-ink-300">
              No mastery nodes unlocked yet. Earn Insight and spend it in
              the Mastery Tree between runs.
            </p>
          ) : (
            <ul className="space-y-1">
              {MASTERY_NODES.filter((n) => masteryNodes.includes(n.id)).map(
                (n) => (
                  <li
                    key={n.id}
                    className="flex items-baseline gap-2 rounded-xl border border-ink-100 bg-cream/40 p-2 dark:border-dark-surface dark:bg-dark-bg/40"
                  >
                    <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-navy dark:text-gold">
                      T{n.tier}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{n.name}</p>
                      <p className="text-[11px] text-ink-700 dark:text-ink-300">
                        {n.description}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>

        {/* Active run-start effects pulled from the mastery node bundle.
            Surfaced separately because some are global modifiers
            (xpGainMult, innerZoneDamageMult) the player can't see
            anywhere else. */}
        <section className="mt-4">
          <SectionHeader title="Active multipliers" />
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <MultRow label="XP gain" value={player.xpGainMult} />
            <MultRow
              label="Projectile speed"
              value={player.projectileSpeedMult}
            />
            <MultRow
              label="Inner-zone damage"
              value={masteryEffects.innerZoneDamageMult}
            />
            <MultRow
              label="Weapon slots"
              value={masteryEffects.weaponCap}
              unit=""
              raw
            />
          </dl>
        </section>

        <div className="mt-5 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={onQuit}
            className="tap-target rounded-xl border border-again/40 bg-transparent px-4 text-sm font-semibold text-again hover:bg-again/10"
          >
            End run
          </button>
          <button
            type="button"
            onClick={onResume}
            className="tap-target rounded-xl bg-navy px-4 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
          >
            Resume
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-ink-500 dark:text-ink-300">
          Esc or P resumes too.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
      {title}
      {count !== undefined && (
        <span className="ml-1 text-ink-700 dark:text-ink-300">({count})</span>
      )}
    </h3>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </dt>
      <dd className="text-base font-semibold">{value}</dd>
    </div>
  );
}

function MultRow({
  label,
  value,
  unit = "×",
  raw = false,
}: {
  label: string;
  value: number;
  unit?: string;
  raw?: boolean;
}) {
  const shown = raw ? String(value) : `${unit}${value.toFixed(2)}`;
  return (
    <>
      <dt className="text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="text-right font-medium">{shown}</dd>
    </>
  );
}

function TagBonusGrid({ tagBonus }: { tagBonus: TagBonus }) {
  // Only show tags that actually have a bonus. If nothing has been
  // picked yet, give the player a hint about the system.
  const rows: { tag: Tag; damage?: number; area?: number; cooldown?: number }[] = [];
  for (const tag of ALL_TAGS) {
    const damage = tagBonus.damage?.[tag] ?? 0;
    const area = tagBonus.area?.[tag] ?? 0;
    const cooldown = tagBonus.cooldown?.[tag] ?? 0;
    if (damage === 0 && area === 0 && cooldown === 0) continue;
    rows.push({ tag, damage, area, cooldown });
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-ink-500 dark:text-ink-300">
        No tag bonuses yet. Pick "+10% kinetic damage"-style upgrades on
        level-up to amplify weapons with that tag.
      </p>
    );
  }
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li
          key={r.tag}
          className="flex flex-wrap items-baseline gap-2 rounded-xl border border-ink-100 bg-cream/40 p-2 dark:border-dark-surface dark:bg-dark-bg/40"
        >
          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy dark:bg-gold/15 dark:text-gold">
            {r.tag}
          </span>
          {r.damage ? (
            <span className="text-xs">
              <span className="text-ink-500 dark:text-ink-300">damage</span>{" "}
              <span className="font-semibold text-good">
                +{Math.round(r.damage * 100)}%
              </span>
            </span>
          ) : null}
          {r.area ? (
            <span className="text-xs">
              <span className="text-ink-500 dark:text-ink-300">area</span>{" "}
              <span className="font-semibold text-good">
                +{Math.round(r.area * 100)}%
              </span>
            </span>
          ) : null}
          {r.cooldown ? (
            <span className="text-xs">
              <span className="text-ink-500 dark:text-ink-300">cooldown</span>{" "}
              <span className="font-semibold text-good">
                {r.cooldown > 0 ? "+" : ""}
                {Math.round(r.cooldown * 100)}%
              </span>
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
