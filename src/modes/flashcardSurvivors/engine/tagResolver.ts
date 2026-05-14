// Tag-bonus resolver (Survivors-Spec §2.7).
//
// Weapons carry one or more tags (kinetic / energy / summon / support /
// synergy). Generic upgrades target tags ("+10% kinetic damage"); when
// they stack on a multi-tag weapon, the bonuses add per tag, then the
// engine picks the highest applicable mult so the player isn't punished
// for a multi-tag weapon — they get the *best* of the relevant ticks.

import type { Tag, TagBonus } from "./types";

export function effectiveDamageMult(
  weaponTags: readonly Tag[],
  bonus: TagBonus,
): number {
  let best = 0;
  for (const tag of weaponTags) {
    const v = bonus.damage?.[tag] ?? 0;
    if (v > best) best = v;
  }
  return 1 + best;
}

export function effectiveAreaMult(
  weaponTags: readonly Tag[],
  bonus: TagBonus,
): number {
  let best = 0;
  for (const tag of weaponTags) {
    const v = bonus.area?.[tag] ?? 0;
    if (v > best) best = v;
  }
  return 1 + best;
}

// Cooldown multiplier — bonus values are negative for "faster" so we
// apply a 1 + bonus product (e.g. -0.10 -> 0.90 = 10% faster).
export function effectiveCooldownMult(
  weaponTags: readonly Tag[],
  bonus: TagBonus,
): number {
  let best = 0;
  for (const tag of weaponTags) {
    const v = bonus.cooldown?.[tag] ?? 0;
    if (v < best) best = v;
  }
  return Math.max(0.4, 1 + best); // clamp so cooldowns never collapse
}

// Adds a +N% modifier to a tag's damage track.
export function addDamageBonus(bonus: TagBonus, tag: Tag, pct: number): TagBonus {
  const next: TagBonus = { ...bonus, damage: { ...(bonus.damage ?? {}) } };
  next.damage![tag] = (bonus.damage?.[tag] ?? 0) + pct;
  return next;
}

export function addAreaBonus(bonus: TagBonus, tag: Tag, pct: number): TagBonus {
  const next: TagBonus = { ...bonus, area: { ...(bonus.area ?? {}) } };
  next.area![tag] = (bonus.area?.[tag] ?? 0) + pct;
  return next;
}

export function addCooldownBonus(
  bonus: TagBonus,
  tag: Tag,
  pct: number,
): TagBonus {
  const next: TagBonus = { ...bonus, cooldown: { ...(bonus.cooldown ?? {}) } };
  next.cooldown![tag] = (bonus.cooldown?.[tag] ?? 0) + pct;
  return next;
}
