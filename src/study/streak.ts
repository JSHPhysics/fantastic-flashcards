// Streak update at the end of a review session. Per Playbook section 7:
//
// - Streak day = any calendar day with at least one review.
// - One rest day allowed per streak run (tracked via restDayUsedDate).
// - Two or more consecutive missed days resets the streak.
//
// The day-difference math uses UTC to avoid daylight-saving cliffs.

import { db } from "../db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  // Local-date string (YYYY-MM-DD) so a session at 11pm and another at 1am
  // the next day count as different days in the user's wall clock.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromIso: string, to: Date): number {
  if (!fromIso) return Infinity;
  // Treat both as local-date midnight, count whole days between.
  const [y, m, d] = fromIso.split("-").map(Number);
  const fromMs = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const toMs = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((toMs - fromMs) / DAY_MS);
}

export async function bumpStreakForReview(
  now: Date = new Date(),
): Promise<void> {
  await db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("self");
    if (!p) return;
    const today = isoDate(now);
    if (p.lastReviewDate === today) return; // already counted today

    const gap = daysBetween(p.lastReviewDate, now);
    let streakDays: number;
    let restDayUsedDate = p.restDayUsedDate;

    if (gap === 1 || !p.lastReviewDate) {
      // First-ever review, or contiguous day.
      streakDays = (p.lastReviewDate ? p.streakDays : 0) + 1;
    } else if (gap === 2) {
      // One day missed. Allowed once per streak run; the rest day used flag
      // is cleared whenever the streak resets.
      const restAlreadyUsed = Boolean(restDayUsedDate);
      if (!restAlreadyUsed) {
        streakDays = p.streakDays + 1;
        // Mark yesterday as the rest day.
        const yesterday = new Date(now.getTime() - DAY_MS);
        restDayUsedDate = isoDate(yesterday);
      } else {
        streakDays = 1;
        restDayUsedDate = undefined;
      }
    } else {
      // 2+ missed days -> reset.
      streakDays = 1;
      restDayUsedDate = undefined;
    }

    const longestStreak = Math.max(p.longestStreak, streakDays);

    const update: Partial<typeof p> = {
      streakDays,
      longestStreak,
      lastReviewDate: today,
      restDayUsedDate,
    };
    await db.profile.update("self", update);
  });
}
