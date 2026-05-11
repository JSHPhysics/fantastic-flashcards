// Derived per-deck stats: last reviewed timestamp and current streak.
// Driven by the reviews table so the numbers stay honest without any extra
// denormalised state.

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/schema";
import type { ReviewEvent } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DeckPracticeStats {
  // ms timestamp of the most recent review for this deck; 0 if never.
  lastReviewedAt: number;
  // Consecutive days, ending today or yesterday, that this deck had at
  // least one review. 0 if the chain has been broken.
  streakDays: number;
}

const EMPTY_STATS: DeckPracticeStats = { lastReviewedAt: 0, streakDays: 0 };

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previousDateString(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, (d ?? 1) - 1);
  return localDateString(date);
}

function computeStreak(dates: Set<string>, now: Date = new Date()): number {
  if (dates.size === 0) return 0;
  const today = localDateString(now);
  const yesterday = localDateString(new Date(now.getTime() - DAY_MS));
  // Streak only counts if the user has practised today OR yesterday.
  // (Practising yesterday but not today is still a "live" streak with one
  // day of slack; if they don't practise today the streak will reset.)
  let cursor: string;
  if (dates.has(today)) cursor = today;
  else if (dates.has(yesterday)) cursor = yesterday;
  else return 0;

  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = previousDateString(cursor);
  }
  return streak;
}

function buildStatsMap(reviews: ReviewEvent[]): Map<string, DeckPracticeStats> {
  const datesByDeck = new Map<string, Set<string>>();
  const lastByDeck = new Map<string, number>();
  for (const r of reviews) {
    let dates = datesByDeck.get(r.deckId);
    if (!dates) {
      dates = new Set();
      datesByDeck.set(r.deckId, dates);
    }
    dates.add(localDateString(new Date(r.timestamp)));
    const prevLast = lastByDeck.get(r.deckId) ?? 0;
    if (r.timestamp > prevLast) lastByDeck.set(r.deckId, r.timestamp);
  }
  const result = new Map<string, DeckPracticeStats>();
  for (const [deckId, dates] of datesByDeck) {
    result.set(deckId, {
      lastReviewedAt: lastByDeck.get(deckId) ?? 0,
      streakDays: computeStreak(dates),
    });
  }
  return result;
}

// One subscription to the reviews table that returns stats keyed by deckId.
// The DeckTree calls this once and passes the map down so the home screen
// doesn't open N subscriptions for N decks.
export function useDeckPracticeStatsMap(): Map<string, DeckPracticeStats> {
  return (
    useLiveQuery(async () => {
      const reviews = await db.reviews.toArray();
      return buildStatsMap(reviews);
    }) ?? new Map<string, DeckPracticeStats>()
  );
}

// Stats for a single deck. Used by DeckDetailPage where we only need one.
export function useDeckPracticeStats(
  deckId: string | undefined,
): DeckPracticeStats {
  return (
    useLiveQuery(async () => {
      if (!deckId) return EMPTY_STATS;
      const reviews = await db.reviews
        .where("deckId")
        .equals(deckId)
        .toArray();
      return buildStatsMap(reviews).get(deckId) ?? EMPTY_STATS;
    }, [deckId]) ?? EMPTY_STATS
  );
}

// Friendly relative-time formatter. "Today" / "Yesterday" / "3 days ago" /
// "2 weeks ago" / "5 months ago" / "1 year ago".
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  if (!timestamp) return "Never";
  const tsDate = new Date(timestamp);
  const nowDate = new Date(now);
  const tsDay = localDateString(tsDate);
  const today = localDateString(nowDate);
  if (tsDay === today) return "Today";
  const yesterday = localDateString(new Date(now - DAY_MS));
  if (tsDay === yesterday) return "Yesterday";

  const days = Math.floor((now - timestamp) / DAY_MS);
  if (days < 0) return "Today";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
