// How active mastery nodes modify the engine's starting state
// (Survivors-Spec §2.9 — applied before the engine starts ticking).

import { isUnlocked, type MasteryNodeId } from "./tree";

export interface MasteryEffects {
  startingHpBonus: number;
  xpGainMult: number;
  projectileSpeedMult: number;
  persistentRecallAvailable: boolean;
  rerollPerLevelUp: number;
  bossUpgradeChoiceCount: number;
  innerZoneDamageMult: number;
  startingRecallCannonLevel: number;
  tagUpgradeStacks: number;
  weaponCap: number;
  eliteSpawnRateBoost: number;
  insanityUnlocked: boolean;
}

export function applyMasteryEffects(unlocked: readonly string[]): MasteryEffects {
  const has = (id: MasteryNodeId) => isUnlocked(unlocked, id);
  return {
    startingHpBonus: has("mnemonic-reserve") ? 20 : 0,
    xpGainMult: has("quick-study") ? 1.1 : 1,
    projectileSpeedMult: has("practiced-hands") ? 1.05 : 1,
    persistentRecallAvailable: has("persistent-recall"),
    rerollPerLevelUp: has("reroll-insight") ? 1 : 0,
    bossUpgradeChoiceCount: has("boss-wisdom") ? 4 : 3,
    innerZoneDamageMult: has("vigilance") ? 1.15 : 1,
    startingRecallCannonLevel: has("diligent-practice") ? 2 : 1,
    tagUpgradeStacks: has("synergy-theorist") ? 2 : 1,
    weaponCap: has("boundless-arsenal") ? 6 : 5,
    eliteSpawnRateBoost: has("elite-spawning") ? 0.25 : 0,
    insanityUnlocked: has("forgotten-mastery"),
  };
}
