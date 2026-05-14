// Persistence wrappers for the survivor tables (Survivors-Spec §2.13).
//
// Three Dexie tables: survivorRuns (one row per completed run),
// survivorStats (single-row best-of summary), survivorMastery (single-
// row insight balance + unlocked node ids). All keyed by "self" except
// survivorRuns which uses generated ids.

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../../db/schema";
import { newId } from "../../../db/ids";
import type {
  SurvivorMastery,
  SurvivorRun,
  SurvivorStats,
  SurvivorDifficulty,
  SurvivorInputMode,
} from "../../../db";
import type { RunSummary } from "../engine/types";
import { canPurchase, MASTERY_NODES, type MasteryNode } from "../mastery/tree";

const STATS_DEFAULT: SurvivorStats = {
  id: "self",
  bestDurationMs: {},
  bestCardsKilled: {},
  bestStreak: 0,
  totalRuns: 0,
  weaponUseCounts: {},
};

const MASTERY_DEFAULT: SurvivorMastery = {
  id: "self",
  insightBalance: 0,
  insightLifetime: 0,
  unlockedNodes: [],
};

export async function getStats(): Promise<SurvivorStats> {
  return (await db.survivorStats.get("self")) ?? STATS_DEFAULT;
}

export async function getMastery(): Promise<SurvivorMastery> {
  return (await db.survivorMastery.get("self")) ?? MASTERY_DEFAULT;
}

// Save a finished run, update the best-of stats, credit insight.
export async function recordRun(summary: RunSummary): Promise<void> {
  const id = newId();
  const run: SurvivorRun = {
    id,
    startedAt: Date.now() - summary.durationMs,
    endedAt: Date.now(),
    durationMs: summary.durationMs,
    difficulty: summary.difficulty,
    inputMode: summary.inputMode,
    cardsKilled: summary.cardsKilled,
    bossesKilled: summary.bossesKilled,
    finalLevel: summary.finalLevel,
    weapons: summary.weapons.map((w) => ({ id: w.id, level: w.level })),
    decksPlayed: summary.decks,
    bestStreak: summary.bestStreak,
    insightEarned: summary.insightEarned,
    cause: summary.cause,
  };
  await db.survivorRuns.add(run);

  const stats = await getStats();
  const next: SurvivorStats = {
    ...stats,
    totalRuns: stats.totalRuns + 1,
    bestStreak: Math.max(stats.bestStreak, summary.bestStreak),
    bestDurationMs: { ...stats.bestDurationMs },
    bestCardsKilled: { ...stats.bestCardsKilled },
    weaponUseCounts: { ...stats.weaponUseCounts },
  };
  const bDur = bucket(next.bestDurationMs, summary.difficulty, summary.inputMode);
  if (summary.durationMs > bDur) {
    setBucket(next.bestDurationMs, summary.difficulty, summary.inputMode, summary.durationMs);
  }
  const bCards = bucket(next.bestCardsKilled, summary.difficulty, summary.inputMode);
  if (summary.cardsKilled > bCards) {
    setBucket(next.bestCardsKilled, summary.difficulty, summary.inputMode, summary.cardsKilled);
  }
  for (const w of summary.weapons) {
    next.weaponUseCounts[w.id] = (next.weaponUseCounts[w.id] ?? 0) + 1;
  }
  await db.survivorStats.put(next);

  const mastery = await getMastery();
  await db.survivorMastery.put({
    ...mastery,
    insightBalance: mastery.insightBalance + summary.insightEarned,
    insightLifetime: mastery.insightLifetime + summary.insightEarned,
  });
}

// Atomic-ish: rejects the purchase if balance changed underneath us.
export async function purchaseNode(nodeId: string): Promise<{ ok: boolean; reason?: string }> {
  const node: MasteryNode | undefined = MASTERY_NODES.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: "Unknown node" };
  return db.transaction("rw", db.survivorMastery, async () => {
    const cur = (await db.survivorMastery.get("self")) ?? MASTERY_DEFAULT;
    if (!canPurchase(node, cur.unlockedNodes, cur.insightBalance)) {
      return { ok: false, reason: "Not eligible yet — check prereqs and balance." };
    }
    await db.survivorMastery.put({
      ...cur,
      insightBalance: cur.insightBalance - node.cost,
      unlockedNodes: [...cur.unlockedNodes, node.id],
    });
    return { ok: true };
  });
}

// React hooks.
export function useMastery(): SurvivorMastery | undefined {
  return useLiveQuery(() => db.survivorMastery.get("self") ?? Promise.resolve(MASTERY_DEFAULT));
}
export function useStats(): SurvivorStats | undefined {
  return useLiveQuery(() => db.survivorStats.get("self") ?? Promise.resolve(STATS_DEFAULT));
}
export function useRecentRuns(limit = 10): SurvivorRun[] | undefined {
  return useLiveQuery(() =>
    db.survivorRuns.orderBy("startedAt").reverse().limit(limit).toArray(),
  );
}

// ---- helpers ----

function bucket(
  rec: Partial<Record<SurvivorDifficulty, Partial<Record<SurvivorInputMode, number>>>>,
  d: SurvivorDifficulty,
  m: SurvivorInputMode,
): number {
  return rec[d]?.[m] ?? 0;
}
function setBucket(
  rec: Partial<Record<SurvivorDifficulty, Partial<Record<SurvivorInputMode, number>>>>,
  d: SurvivorDifficulty,
  m: SurvivorInputMode,
  value: number,
): void {
  if (!rec[d]) rec[d] = {};
  rec[d]![m] = value;
}
