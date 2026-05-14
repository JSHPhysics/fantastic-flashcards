// Difficulty parameter sets (Survivors-Spec §2.5).
//
// All knobs in one place so balancing later is a one-file diff. Values are
// interpolated over a 5-minute ramp: spawnIntervalAt(t) blends between
// initialSpawnIntervalMs and finalSpawnIntervalMs.

import type { SurvivorDifficulty } from "../../../db";

export interface DifficultyConfig {
  id: SurvivorDifficulty;
  startingHp: number;
  initialSpawnIntervalMs: number;
  finalSpawnIntervalMs: number;
  // Max concurrent enemies = base + floor(minutesElapsed * perMinute), capped.
  maxConcurrent: { base: number; perMinute: number; cap: number };
  waveEventIntervalMs: number;
  bossIntervalMs: number;
  contactDamageMult: number;
  xpGainMult: number;
  insightMult: number;
}

const FIVE_MIN_MS = 5 * 60 * 1000;

export const DIFFICULTIES: Record<SurvivorDifficulty, DifficultyConfig> = {
  easy: {
    id: "easy",
    startingHp: 120,
    initialSpawnIntervalMs: 3000,
    finalSpawnIntervalMs: 900,
    maxConcurrent: { base: 4, perMinute: 1.5, cap: 18 },
    waveEventIntervalMs: 75_000,
    bossIntervalMs: 4 * 60_000,
    contactDamageMult: 0.7,
    xpGainMult: 1.0,
    insightMult: 1.0,
  },
  normal: {
    id: "normal",
    startingHp: 100,
    initialSpawnIntervalMs: 2500,
    finalSpawnIntervalMs: 600,
    maxConcurrent: { base: 5, perMinute: 2, cap: 25 },
    waveEventIntervalMs: 60_000,
    bossIntervalMs: 3 * 60_000,
    contactDamageMult: 1.0,
    xpGainMult: 1.0,
    insightMult: 1.5,
  },
  hard: {
    id: "hard",
    startingHp: 80,
    initialSpawnIntervalMs: 2000,
    finalSpawnIntervalMs: 450,
    maxConcurrent: { base: 6, perMinute: 2.5, cap: 32 },
    waveEventIntervalMs: 45_000,
    bossIntervalMs: 2.5 * 60_000,
    contactDamageMult: 1.3,
    xpGainMult: 1.15,
    insightMult: 2.0,
  },
  insane: {
    // Unlocked via "Forgotten Mastery" mastery node. Tuned tougher and
    // triples Insight per spec §2.9.
    id: "insane",
    startingHp: 70,
    initialSpawnIntervalMs: 1500,
    finalSpawnIntervalMs: 350,
    maxConcurrent: { base: 7, perMinute: 3, cap: 40 },
    waveEventIntervalMs: 35_000,
    bossIntervalMs: 2 * 60_000,
    contactDamageMult: 1.6,
    xpGainMult: 1.25,
    insightMult: 3.0,
  },
};

// Linear interpolation of spawn interval against runtime elapsed.
export function spawnIntervalAt(cfg: DifficultyConfig, elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / FIVE_MIN_MS);
  return cfg.initialSpawnIntervalMs + (cfg.finalSpawnIntervalMs - cfg.initialSpawnIntervalMs) * t;
}

export function maxConcurrentAt(cfg: DifficultyConfig, elapsedMs: number): number {
  const minutes = elapsedMs / 60_000;
  return Math.min(cfg.maxConcurrent.cap, Math.floor(cfg.maxConcurrent.base + minutes * cfg.maxConcurrent.perMinute));
}
