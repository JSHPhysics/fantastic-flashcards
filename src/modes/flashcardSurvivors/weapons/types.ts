// Weapon interface for Flashcard Survivors (Survivors-Spec §2.7).
//
// Each weapon ships its own tick() function that runs every engine
// frame — fires projectiles, ticks down cooldowns, etc. — plus optional
// event handlers for "on correct answer" and "on kill" so synergy
// weapons (Recap Volley, Spaced Salvo, Elaboration Cloud) can react.
//
// The behaviour function receives a *handle* into the engine rather
// than the full engine instance. This keeps the weapon API narrow and
// makes the behaviours easy to test in isolation.

import type { Card } from "../../../db";
import type { Enemy, OwnedWeapon, Projectile, Tag, Vec2 } from "../engine/types";

export interface WeaponHandle {
  // Engine time in ms.
  now: number;
  // All enemies, sorted by distance to centre ascending.
  enemies: Enemy[];
  // Player position (always 0,0 in centre-coord space, but exposed in
  // case we ever move the turret).
  playerPos: Vec2;
  // Effective damage multiplier resolved against the weapon's tags +
  // the player's TagBonus.
  damageMult: number;
  areaMult: number;
  cooldownMult: number;
  // Projectile speed multiplier from generic player upgrades.
  projectileSpeedMult: number;
  // Spawn helper — engine adds the projectile to its own list.
  spawnProjectile: (p: Omit<Projectile, "id">) => void;
  // Emit a DoT cloud (Elaboration Cloud).
  spawnCloud: (centre: Vec2, radius: number, dps: number, durationMs: number, tag: string | null) => void;
  // Subtract HP from an enemy (used by Mnemonic Pulse / Reasoning Beam
  // direct-damage weapons that don't go through a projectile).
  dealDamage: (enemyId: string, amount: number) => void;
  // Streak helper.
  streak: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  tags: readonly Tag[];
  description: string;
  // Pretty per-level descriptions for the level-up modal: index 0 = level 1.
  perLevel: string[];
  // Called every engine tick. State scratch lives on OwnedWeapon.state.
  tick: (h: WeaponHandle, w: OwnedWeapon, dtMs: number) => void;
  // Synergy hooks — optional.
  onCorrectAnswer?: (h: WeaponHandle, w: OwnedWeapon, enemy: Enemy, speedBonus: number) => void;
  onKill?: (h: WeaponHandle, w: OwnedWeapon, enemy: Enemy, card: Card) => void;
  // For Recall Cannon specifically — fires once per correct answer with
  // an explicit speed bonus. Other weapons ignore.
}
