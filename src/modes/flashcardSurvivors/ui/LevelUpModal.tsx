// Level-up modal (Survivors-Spec §2.10).
// Three upgrade choices, keyboard-pickable (1/2/3 + R to reroll if the
// "Reroll Insight" mastery is unlocked).
//
// Uses theme tokens — `bg-surface` modal on a `bg-black/60` scrim that
// reads correctly against every theme. Body text is `text-ink-900` so
// dark themes (Midnight, Volcanic) and light themes (Cherry Blossom,
// Slate) both render readable text.

import { useEffect, useState } from "react";
import type { UpgradeChoice } from "../upgrades/pool";
import type { GameEngine } from "../engine/GameEngine";
import type { OwnedWeapon, PlayerStats, Tag, TagBonus } from "../engine/types";
import { getWeaponDef } from "../weapons/registry";

interface LevelUpModalProps {
  engine: GameEngine;
  choices: UpgradeChoice[];
  player: PlayerStats;
  weapons: OwnedWeapon[];
  onClose: () => void;
}

// What the player *already has* relative to this choice. Surfaced as a
// one-line "Now: …" hint under each upgrade card so the choice between
// "+10% summon damage" and "+10% kinetic damage" doesn't require them
// to recall what they're holding. We special-case each category:
//
//   - tag-upgrade: list how many owned weapons share the tag + any
//     bonus already stacked for that (tag, kind) pair. The student's
//     question of "Do I have any summon weapons at all?" gets a
//     definitive yes/no.
//   - weapon-upgrade: current level so the title's "→ L3" reads as a
//     delta instead of an absolute.
//   - player-upgrade: the current value of the relevant stat so
//     "+15 max HP" appears next to "Now: 100 max HP".
//   - exotic: most exotics are one-shot flags; only label them when
//     they're already active so the student doesn't waste a pick.
//   - new-weapon: no hint — the "NEW · " prefix already says it.
//
// Returns null when there's nothing useful to add.
function currentLabel(
  c: UpgradeChoice,
  player: PlayerStats,
  weapons: OwnedWeapon[],
  tagBonus: TagBonus,
): string | null {
  if (c.category === "tag-upgrade") {
    // id shape: `tag-${tag}-${kind}`
    const m = c.id.match(/^tag-(\w+)-(damage|area|cooldown)$/);
    if (!m) return null;
    const tag = m[1] as Tag;
    const kind = m[2] as "damage" | "area" | "cooldown";
    const owned = weapons
      .map((w) => getWeaponDef(w.id))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .filter((d) => d.tags.includes(tag));
    const existing = tagBonus[kind]?.[tag] ?? 0;
    if (owned.length === 0) {
      return `You have no ${tag} weapons — this won't do anything yet.`;
    }
    const names = owned.map((d) => d.name).join(", ");
    const sign = existing > 0 ? "+" : existing < 0 ? "" : "";
    const pct = Math.round(Math.abs(existing) * 100);
    const existingStr =
      existing === 0
        ? ""
        : ` · already ${sign}${existing < 0 ? "-" : ""}${pct}% ${kind}`;
    const plural = owned.length === 1 ? "" : "s";
    return `${owned.length} ${tag} weapon${plural} (${names})${existingStr}`;
  }
  if (c.category === "weapon-upgrade") {
    // id shape: `up-${weaponId}-${nextLevel}`. Strip the trailing
    // -<digits> rather than matching it, because weapon ids can
    // themselves contain hyphens (e.g. `drone-cannon`).
    const m = c.id.match(/^up-(.+)-(\d+)$/);
    if (!m) return null;
    const wid = m[1];
    const owned = weapons.find((w) => w.id === wid);
    if (!owned) return null;
    return `Now: L${owned.level}`;
  }
  if (c.category === "player-upgrade") {
    if (c.id === "player-hp") return `Now: ${player.maxHp} max HP`;
    if (c.id === "player-xp") {
      const pct = Math.round((player.xpGainMult - 1) * 100);
      return pct === 0 ? "Now: base XP gain" : `Now: +${pct}% XP gain`;
    }
    if (c.id === "player-projectile-speed") {
      const pct = Math.round((player.projectileSpeedMult - 1) * 100);
      return pct === 0
        ? "Now: base projectile speed"
        : `Now: +${pct}% projectile speed`;
    }
    return null;
  }
  if (c.category === "exotic") {
    if (c.id === "exotic-boss-drops" && player.bossKillsDropTwoUpgrades) {
      return "Already active — picking again is wasted.";
    }
    if (c.id === "exotic-elite-spawn" && player.eliteSpawnRateBoost > 0) {
      const pct = Math.round(player.eliteSpawnRateBoost * 100);
      return `Already +${pct}% elite spawn — picks stack.`;
    }
    return null;
  }
  return null;
}

export function LevelUpModal({
  engine,
  choices: initial,
  player,
  weapons,
  onClose,
}: LevelUpModalProps) {
  const [choices, setChoices] = useState(initial);
  const [rerolls, setRerolls] = useState(engine.rerollsRemaining());
  // Read once on open — the engine is paused while the modal lives, so
  // tagBonus, player, and weapons all stay stable until we close.
  const tagBonus = engine.getTagBonus();

  const pick = (c: UpgradeChoice) => {
    engine.applyUpgrade(c);
    onClose();
  };
  const reroll = () => {
    if (rerolls <= 0) return;
    const next = engine.rerollLevelUp();
    setChoices(next);
    setRerolls(engine.rerollsRemaining());
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" || e.key === "2" || e.key === "3") {
        const idx = Number.parseInt(e.key, 10) - 1;
        if (choices[idx]) pick(choices[idx]);
      } else if (e.key.toLowerCase() === "r") {
        reroll();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, rerolls]);

  return (
    // Scrim is fixed inset-0 of the survivors viewport. Inner panel
    // gets max-h-[90dvh] + overflow-y-auto so three stacked upgrade
    // cards stay reachable on a phone in landscape, and the body
    // scrolls under the sticky header instead of pushing the reroll
    // button below the fold.
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 px-2 py-3 backdrop-blur sm:px-4">
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-y-auto px-1">
        <h2 className="text-center text-xl font-semibold text-cream drop-shadow-lg sm:text-2xl dark:text-dark-ink">
          Level up — pick one
        </h2>
        <p className="mt-1 text-center text-[11px] text-cream/80 sm:text-xs dark:text-dark-ink/80">
          {rerolls > 0
            ? `Tap a card. Keyboard 1 / 2 / 3 picks · R rerolls (${rerolls} left).`
            : "Tap a card."}
        </p>
        <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-3">
          {choices.map((c, i) => {
            const ctx = currentLabel(c, player, weapons, tagBonus);
            // Soft-warn the student if the upgrade is wasted in its
            // current shape — no weapons with the tag, or an exotic
            // flag that's already on. Renders the same hint chip but
            // with the "hard" palette so it stands out.
            const isWasted =
              c.category === "tag-upgrade" &&
              !!ctx &&
              ctx.startsWith("You have no");
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                className="flex h-full flex-col rounded-2xl border-2 border-ink-100 bg-surface p-3 text-left text-ink-900 shadow-xl transition-colors hover:border-gold sm:p-4 dark:border-dark-surface dark:text-dark-ink"
              >
                <span className="text-xs text-gold">
                  {c.category.replace("-", " ").toUpperCase()} · {i + 1}
                </span>
                <span className="mt-1 text-base font-semibold">{c.title}</span>
                {c.tags && c.tags.length > 0 && (
                  // Tag chips on weapon cards — pair these with later
                  // `+10% <tag> damage` upgrades for synergy.
                  <ul className="mt-1.5 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <li
                        key={t}
                        className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-navy dark:bg-gold/15 dark:text-gold"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-2 flex-1 text-xs leading-snug text-ink-700 dark:text-ink-300">
                  {c.description}
                </span>
                {ctx && (
                  <span
                    className={`mt-2 rounded-md px-2 py-1 text-[11px] leading-snug ${
                      isWasted
                        ? "bg-hard/15 text-hard"
                        : "bg-ink-100 text-ink-700 dark:bg-dark-bg dark:text-ink-300"
                    }`}
                  >
                    {ctx}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {rerolls > 0 && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={reroll}
              className="tap-target rounded-md bg-surface/85 px-3 text-xs text-ink-900 shadow-md hover:bg-surface dark:text-dark-ink"
            >
              Reroll ({rerolls})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
