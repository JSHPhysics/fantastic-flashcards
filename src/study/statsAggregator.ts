// Data aggregations for the Stats screen and per-deck stats.
// Everything is computed from the reviews + sessions tables; nothing extra
// is denormalised on the records.

import { db } from "../db/schema";
import type { Card, ReviewEvent, Session, Rating } from "../db";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayStats {
  date: string; // YYYY-MM-DD (local)
  cards: number;
  correct: number;
  totalTimeMs: number;
}

export interface TodayStats extends DayStats {
  accuracy: number; // 0-100
  byRating: Record<Rating, number>;
}

export interface WeekStats {
  days: TodayStats[]; // 7 entries, oldest first, ending today
  totalCards: number;
  averageAccuracy: number; // 0-100
}

// Heatmap covers the last 52 weeks ending the current week.
// Each cell is a calendar day with its review count.
export interface HeatmapCell {
  date: string;
  count: number;
}

export interface YearHeatmap {
  // Rows are days of week (0 = Sunday); columns are weeks oldest -> newest.
  // Cells are addressed grid[row][col].
  grid: (HeatmapCell | null)[][];
  weeksShown: number;
  totalReviews: number;
  daysActive: number;
  maxCount: number;
}

export interface DeckMaturity {
  newCount: number;
  learningCount: number;
  matureCount: number;
}

// ---- Local date helpers ----

export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

// ---- Aggregations ----

export function aggregateReviewsByDay(
  reviews: ReviewEvent[],
): Map<string, ReviewEvent[]> {
  const map = new Map<string, ReviewEvent[]>();
  for (const r of reviews) {
    const key = localDateString(new Date(r.timestamp));
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}

function emptyDayStats(date: string): TodayStats {
  return {
    date,
    cards: 0,
    correct: 0,
    totalTimeMs: 0,
    accuracy: 0,
    byRating: { 1: 0, 2: 0, 3: 0, 4: 0 },
  };
}

function summariseDay(date: string, reviews: ReviewEvent[]): TodayStats {
  const stats = emptyDayStats(date);
  for (const r of reviews) {
    stats.cards += 1;
    stats.totalTimeMs += r.timeTakenMs;
    stats.byRating[r.rating] += 1;
    if (r.rating >= 3) stats.correct += 1;
  }
  stats.accuracy = stats.cards === 0 ? 0 : Math.round((stats.correct / stats.cards) * 100);
  return stats;
}

export async function loadToday(now: Date = new Date()): Promise<TodayStats> {
  const start = startOfLocalDay(now).getTime();
  const reviews = await db.reviews
    .where("timestamp")
    .aboveOrEqual(start)
    .toArray();
  return summariseDay(localDateString(now), reviews);
}

export async function loadWeek(now: Date = new Date()): Promise<WeekStats> {
  const start = startOfLocalDay(new Date(now.getTime() - 6 * DAY_MS)).getTime();
  const reviews = await db.reviews
    .where("timestamp")
    .aboveOrEqual(start)
    .toArray();
  const grouped = aggregateReviewsByDay(reviews);

  const days: TodayStats[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dayDate = new Date(now.getTime() - i * DAY_MS);
    const key = localDateString(dayDate);
    days.push(summariseDay(key, grouped.get(key) ?? []));
  }

  const totalCards = days.reduce((sum, d) => sum + d.cards, 0);
  const dayswWithReviews = days.filter((d) => d.cards > 0);
  const averageAccuracy =
    dayswWithReviews.length === 0
      ? 0
      : Math.round(
          dayswWithReviews.reduce((sum, d) => sum + d.accuracy, 0) /
            dayswWithReviews.length,
        );

  return { days, totalCards, averageAccuracy };
}

export async function loadYearHeatmap(
  now: Date = new Date(),
): Promise<YearHeatmap> {
  const WEEKS = 53; // a bit more than a year so the heatmap always fills the row
  const todayStart = startOfLocalDay(now);
  // The heatmap's right edge ends on the current week's Saturday-equivalent.
  // We anchor on day-of-week so each column is one calendar week.
  const todayDow = todayStart.getDay(); // 0 = Sunday
  const lastDay = new Date(todayStart);
  lastDay.setDate(lastDay.getDate() + (6 - todayDow)); // end on Saturday
  const firstDay = new Date(lastDay);
  firstDay.setDate(firstDay.getDate() - (WEEKS * 7 - 1));

  const reviews = await db.reviews
    .where("timestamp")
    .aboveOrEqual(firstDay.getTime())
    .toArray();
  const counts = new Map<string, number>();
  for (const r of reviews) {
    const key = localDateString(new Date(r.timestamp));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const grid: (HeatmapCell | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: WEEKS }, () => null),
  );
  let maxCount = 0;
  let totalReviews = 0;
  let daysActive = 0;

  for (let col = 0; col < WEEKS; col += 1) {
    for (let row = 0; row < 7; row += 1) {
      const day = new Date(firstDay);
      day.setDate(day.getDate() + col * 7 + row);
      if (day > todayStart) continue;
      const key = localDateString(day);
      const count = counts.get(key) ?? 0;
      grid[row][col] = { date: key, count };
      if (count > 0) {
        daysActive += 1;
        totalReviews += count;
        if (count > maxCount) maxCount = count;
      }
    }
  }

  return {
    grid,
    weeksShown: WEEKS,
    totalReviews,
    daysActive,
    maxCount,
  };
}

// Per-deck card maturity. ts-fsrs state: 0 New, 1 Learning, 2 Review,
// 3 Relearning. Cards with state === Review and scheduled_days > 21 count
// as "mature" per the playbook.
export function deckMaturityFromCards(cards: Card[]): DeckMaturity {
  let newCount = 0;
  let learningCount = 0;
  let matureCount = 0;
  for (const c of cards) {
    if (c.suspended) continue;
    const reps = c.fsrs.reps ?? 0;
    const state = (c.fsrs as { state?: number }).state ?? 0;
    const interval =
      (c.fsrs as { scheduled_days?: number }).scheduled_days ?? 0;
    if (reps === 0) {
      newCount += 1;
    } else if (state === 2 && interval > 21) {
      matureCount += 1;
    } else {
      learningCount += 1;
    }
  }
  return { newCount, learningCount, matureCount };
}

// Helpers for surfacing per-day sessions on tap-to-drill in Week / All-time.
export async function loadSessionsOnDay(
  dateString: string,
): Promise<Session[]> {
  const [y, m, d] = dateString.split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const end = start + DAY_MS;
  return db.sessions
    .where("startedAt")
    .between(start, end, true, false)
    .toArray();
}
