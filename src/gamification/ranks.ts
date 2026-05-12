// Rank system (per spec §2).
//
// Overall mastery = proportion of non-suspended cards across all active
// decks whose FSRS state is "mature" (state === Review/2, scheduled
// interval > 21 days). This matches the existing deckMaturityFromCards
// definition in src/study/statsAggregator.ts so the ranks line up with
// what the Stats screen calls "mature".
//
// rankForPct is a pure function so it can be tested and reused for
// per-deck breakdowns. Rank-up detection happens at session end by
// comparing the rank computed before vs after.

import { db } from "../db/schema";
import { deckMaturityFromCards } from "../study/statsAggregator";
import type { Card } from "../db";

export interface RankInfo {
  id: string;
  label: string;
  minPct: number;
  icon: string;
  message: string;
  // Confetti intensity bucket (per spec): 0 = none, 1 = subtle (Recruit-Master),
  // 2 = bold (Grandmaster, Elite), 3 = legend (Legend).
  confetti: 0 | 1 | 2 | 3;
}

export const RANKS: RankInfo[] = [
  {
    id: "unranked",
    label: "Unranked",
    minPct: 0,
    icon: "○",
    message: "",
    confetti: 0,
  },
  {
    id: "recruit",
    label: "Recruit",
    minPct: 5,
    icon: "🪵",
    message: "Your revision journey begins. Keep going!",
    confetti: 1,
  },
  {
    id: "apprentice",
    label: "Apprentice",
    minPct: 15,
    icon: "📖",
    message: "You're building momentum — great start!",
    confetti: 1,
  },
  {
    id: "scholar",
    label: "Scholar",
    minPct: 25,
    icon: "🎓",
    message: "A quarter of the way there. You're doing this!",
    confetti: 1,
  },
  {
    id: "practitioner",
    label: "Practitioner",
    minPct: 40,
    icon: "⚗️",
    message: "Real progress now. Half the battle is showing up.",
    confetti: 1,
  },
  {
    id: "expert",
    label: "Expert",
    minPct: 55,
    icon: "🔬",
    message: "More than half done. You're well on your way.",
    confetti: 1,
  },
  {
    id: "master",
    label: "Master",
    minPct: 70,
    icon: "⭐",
    message: "Outstanding dedication — you're in the top tier.",
    confetti: 1,
  },
  {
    id: "grandmaster",
    label: "Grandmaster",
    minPct: 82,
    icon: "🌟",
    message: "Nearly there. Push through to the finish!",
    confetti: 2,
  },
  {
    id: "elite",
    label: "Elite",
    minPct: 92,
    icon: "💎",
    message: "So close to perfect. One final push!",
    confetti: 2,
  },
  {
    id: "legend",
    label: "Legend",
    minPct: 100,
    icon: "🏆",
    message: "You've achieved a perfect score. Truly legendary! 🎉",
    confetti: 3,
  },
];

// Pure: takes a 0-100 percentage and returns the highest rank reached.
// Anything below 5% lands at Unranked.
export function rankForPct(pct: number): RankInfo {
  const clamped = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  // Walk highest-to-lowest so the highest qualifying band wins.
  for (let i = RANKS.length - 1; i >= 0; i -= 1) {
    if (clamped >= RANKS[i].minPct) return RANKS[i];
  }
  return RANKS[0];
}

// Returns the overall mastery percentage across every non-suspended card
// in the database. Matches the "mature" definition from the Stats screen.
export async function computeOverallMasteryPct(): Promise<number> {
  const cards = await db.cards.toArray();
  const active = cards.filter((c) => !c.suspended);
  if (active.length === 0) return 0;
  const { matureCount } = deckMaturityFromCards(active);
  return (matureCount / active.length) * 100;
}

// Per-deck mastery — drives the "Double / Triple Legend" detection plus
// the Stats screen's per-deck rank chips.
export async function computePerDeckMastery(): Promise<
  { deckId: string; pct: number; total: number; mature: number }[]
> {
  const cards = await db.cards.toArray();
  const byDeck = new Map<string, Card[]>();
  for (const c of cards) {
    if (c.suspended) continue;
    const list = byDeck.get(c.deckId);
    if (list) list.push(c);
    else byDeck.set(c.deckId, [c]);
  }
  return Array.from(byDeck.entries()).map(([deckId, deckCards]) => {
    const { matureCount } = deckMaturityFromCards(deckCards);
    const pct = deckCards.length === 0 ? 0 : (matureCount / deckCards.length) * 100;
    return { deckId, pct, total: deckCards.length, mature: matureCount };
  });
}

// Helper for the Legend +1/+2 prefix: returns the count of decks at 100%
// mastery. Double Legend = 2+, Triple Legend = 3+ (per spec).
export async function legendMultiplier(): Promise<number> {
  const perDeck = await computePerDeckMastery();
  return perDeck.filter((d) => d.total > 0 && d.pct >= 100).length;
}

// Rank-up detection: compare the rank derived from previous vs new mastery.
// Returns the new rank if it crossed up; null otherwise.
export function detectRankUp(
  previousRankId: string | undefined,
  newPct: number,
): RankInfo | null {
  const newRank = rankForPct(newPct);
  if (!previousRankId) {
    return newRank.id === "unranked" ? null : newRank;
  }
  if (previousRankId === newRank.id) return null;
  const prevIdx = RANKS.findIndex((r) => r.id === previousRankId);
  const newIdx = RANKS.findIndex((r) => r.id === newRank.id);
  return newIdx > prevIdx ? newRank : null;
}
