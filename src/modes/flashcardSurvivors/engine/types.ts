// Shared types for the Flashcard Survivors game engine.
//
// Kept in one file so the entity classes (Enemy, Projectile, Player), the
// weapon registry, the input strategies, and the UI all read from the same
// definitions. The game engine has no React dependency — these types travel
// with it; the React HUD subscribes via the EngineEvent stream.

import type { Card, SurvivorDifficulty, SurvivorInputMode } from "../../../db";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  card: Card;
  // Position in canvas coords (centre of canvas = 0,0). Velocity is no
  // longer stored: the engine derives it each frame from `speed` + the
  // current distance to centre, so the enemy can rush in fast then slow
  // down in the reading zone. See GameEngine.updateEnemies().
  pos: Vec2;
  hp: number;
  maxHp: number;
  // Geometry — rendered as a polygon/circle. Shape index chosen by
  // tag/deck so a player learns to associate shape with content.
  shape: "circle" | "triangle" | "square" | "diamond" | "hex" | "pentagon";
  size: number;
  // Hex colour — pulled from the deck's colour or a tag-derived palette.
  colour: string;
  // Speed at spawn — drift toward centre. Lower retrievability = higher
  // speed, see cardPool.statsForCard().
  speed: number;
  contactDamage: number;
  // True when the card was answered correctly in a previous wave this
  // run; influences Recap Volley among others.
  seenThisRun: boolean;
  // Elite variant — visually distinct, +50% HP, +1 upgrade roll on kill.
  elite: boolean;
  // When the enemy first appeared on screen (engine tick ms). Used for
  // the Recall Cannon speed bonus and stats.
  spawnedAt: number;
  // 4-choice answer tray cache for Tap Mode — populated on first selection
  // and reused across re-selections so the player can't reshuffle. Keyed
  // by run + card id (set on the engine, not here).
  tapChoices?: string[];
}

export type ProjectileKind = "kinetic" | "energy" | "summon";

export interface Projectile {
  id: string;
  pos: Vec2;
  vel: Vec2;
  damage: number;
  // Radius of the projectile sprite + collision.
  radius: number;
  kind: ProjectileKind;
  // Pierce count remaining — 0 means consumed on first hit.
  pierce: number;
  // Optional homing target — `null` for straight-line. The engine
  // adjusts vel toward this target if present.
  homing: string | null;
  // Source weapon id, for tagging splits etc.
  sourceWeapon: string;
  // Lifetime (ms). Projectile despawns at this engine time even if it
  // hasn't hit anything — prevents stale homing missiles from circling.
  expiresAt: number;
  // Optional split-on-hit (Schema Splitter). Number of children to spawn.
  splitOnHit?: number;
  // Optional DoT cloud spawn (Elaboration Cloud) — radius + dps + duration.
  cloudOnExpire?: { radius: number; dps: number; durationMs: number };
}

export interface DotCloud {
  id: string;
  pos: Vec2;
  radius: number;
  dps: number;
  expiresAt: number;
  // Card tag of the killed enemy that spawned this cloud — Elaboration
  // Cloud scales bigger when consecutive kills share tags.
  tag: string | null;
}

export interface OwnedWeapon {
  id: string; // weapon id from registry
  level: number; // 1..5
  // Per-weapon mutable state — cooldown timer, charge stage, target
  // lock ids, etc. Loosely typed so each weapon can store what it needs;
  // owned by the weapon's behaviour function, the engine just hands
  // it back each tick.
  state: Record<string, unknown>;
}

export type Tag = "kinetic" | "energy" | "summon" | "support" | "synergy";

export interface TagBonus {
  // +0.10 means +10% to that category, additive within a category.
  damage?: Partial<Record<Tag, number>>;
  area?: Partial<Record<Tag, number>>;
  cooldown?: Partial<Record<Tag, number>>; // negative = faster
  summonCap?: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  xpToNextLevel: number;
  // Damage / speed multipliers from "player upgrade" rolls.
  projectileSpeedMult: number;
  xpGainMult: number;
  pickupRange: number;
  // Exotic flags
  persistentRecallUsed: boolean; // tracks once-per-run "miss doesn't break streak"
  bossKillsDropTwoUpgrades: boolean;
  eliteSpawnRateBoost: number; // 0 by default, +0.5 doubles elite rate
  // Streak — current consecutive correct answers.
  streak: number;
  bestStreak: number;
}

export interface RunConfig {
  decks: string[]; // deck ids
  difficulty: SurvivorDifficulty;
  inputMode: SurvivorInputMode;
  // Mastery applied at run start.
  masteryNodes: string[];
}

export interface RunSummary {
  durationMs: number;
  cardsKilled: number;
  bossesKilled: number;
  finalLevel: number;
  weapons: OwnedWeapon[];
  bestStreak: number;
  difficulty: SurvivorDifficulty;
  inputMode: SurvivorInputMode;
  decks: string[];
  insightEarned: number;
  cause: "death" | "quit";
}

// Engine-side events the React UI subscribes to (HUD numbers, modal
// triggers). The engine doesn't import React — just emits.
export type EngineEvent =
  | { type: "stats"; player: PlayerStats; weapons: OwnedWeapon[] }
  | { type: "levelUp"; choices: import("../upgrades/pool").UpgradeChoice[] }
  | { type: "gameOver"; summary: RunSummary }
  | { type: "enemiesChanged"; visible: EnemyView[] }
  | { type: "tapChoices"; targetId: string; choices: string[] }
  | { type: "tapCleared" };

// Lightweight per-enemy snapshot for the UI overlay — the engine pushes
// these via the enemiesChanged event so React can render labels (front
// of card) above each enemy without each enemy being a React component.
export interface EnemyView {
  id: string;
  pos: Vec2;
  size: number;
  front: string;
  selected: boolean;
}

export type EngineEventListener = (event: EngineEvent) => void;
