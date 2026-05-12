// Coin economy.
//
// Rules (per spec §1):
//   - 1 coin per unique card reviewed per local calendar day. Reviewing the
//     same card a second time the same day awards nothing.
//   - Optional +1 bonus when the rating is Good or Easy on the *first*
//     review of that card today.
//   - Optional +5 deck-complete bonus, once per deck per day.
//   - Daily cap: 25 coins/day total (base + bonuses combined).
//
// All state lives inside ProfileSettings.coinsToday so it survives reloads
// and round-trips through the backup file. When the local date rolls over,
// the bucket resets transparently on the next award.

import { db } from "../db/schema";
import { bumpVersion } from "../db/profile";
import type { CoinDayBucket, Rating } from "../db/types";

export const DAILY_COIN_CAP = 25;
export const BASE_COIN_PER_CARD = 1;
export const CORRECT_FIRST_BONUS = 1;
export const DECK_COMPLETE_BONUS = 5;

export interface AwardResult {
  awarded: number; // coins added on this call (after cap)
  balance: number; // new total balance
  reachedCap: boolean; // true when the daily cap stopped us giving more
}

// Local YYYY-MM-DD anchor — must match the format used elsewhere
// (statsAggregator.localDateString) so streak + daily-cap comparisons line up.
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function freshBucket(date: string): CoinDayBucket {
  return {
    date,
    cardIds: [],
    firstCorrectCardIds: [],
    deckCompletions: [],
    total: 0,
  };
}

// Resolves "today's" bucket from the persisted one, resetting if the date
// has rolled over. The caller is responsible for writing the result back.
function todayBucket(
  stored: CoinDayBucket | undefined,
  today: string,
): CoinDayBucket {
  if (!stored || stored.date !== today) return freshBucket(today);
  return {
    date: stored.date,
    cardIds: [...stored.cardIds],
    firstCorrectCardIds: [...stored.firstCorrectCardIds],
    deckCompletions: [...stored.deckCompletions],
    total: stored.total,
  };
}

// Atomic helper: read profile, compute updated settings, write back.
// Wrapping in a Dexie tx avoids a race with concurrent setting writes
// (e.g. the user opens settings mid-session and toggles a switch).
async function withProfileSettings<T>(
  fn: (settings: import("../db/types").ProfileSettings) => {
    next: import("../db/types").ProfileSettings;
    result: T;
  },
): Promise<T | null> {
  return db.transaction("rw", db.profile, async () => {
    const profile = await db.profile.get("self");
    if (!profile) return null;
    const { next, result } = fn(profile.settings);
    await db.profile.update("self", { settings: next });
    return result;
  });
}

// Award coins for a single review. Returns what was actually given after
// dedup + daily cap. Quietly returns 0 if the day is already capped.
export async function awardCoinsForReview(input: {
  cardId: string;
  rating: Rating;
  now?: Date;
}): Promise<AwardResult> {
  const now = input.now ?? new Date();
  const today = localDateString(now);

  const result = await withProfileSettings((settings) => {
    const bucket = todayBucket(settings.coinsToday, today);
    const remainingCap = DAILY_COIN_CAP - bucket.total;
    if (remainingCap <= 0) {
      // Day is capped; persist the (possibly-reset) bucket but no coins.
      return {
        next: { ...settings, coinsToday: bucket },
        result: {
          awarded: 0,
          balance: settings.coins ?? 0,
          reachedCap: true,
        } satisfies AwardResult,
      };
    }

    let awarded = 0;
    // Base coin: first time today only.
    if (!bucket.cardIds.includes(input.cardId)) {
      awarded += BASE_COIN_PER_CARD;
      bucket.cardIds.push(input.cardId);
      // First-attempt correct bonus stacks with the base coin.
      if (
        (input.rating === 3 || input.rating === 4) &&
        !bucket.firstCorrectCardIds.includes(input.cardId)
      ) {
        awarded += CORRECT_FIRST_BONUS;
        bucket.firstCorrectCardIds.push(input.cardId);
      }
    }

    // Trim to the daily cap.
    const givable = Math.min(awarded, remainingCap);
    bucket.total += givable;
    const balance = (settings.coins ?? 0) + givable;
    const reachedCap = bucket.total >= DAILY_COIN_CAP;

    return {
      next: {
        ...settings,
        coins: balance,
        coinsToday: bucket,
      },
      result: { awarded: givable, balance, reachedCap } satisfies AwardResult,
    };
  });

  if (!result) return { awarded: 0, balance: 0, reachedCap: false };
  if (result.awarded > 0) await bumpVersion("coins awarded");
  return result;
}

// One +5 bonus per deck per day. Caller decides when a deck is "complete"
// (typically: standard session reaches the end of its queue with all due
// cards reviewed). Quietly no-ops if the bonus was already awarded today
// or the daily cap is reached.
export async function awardDeckCompleteBonus(deckId: string, now: Date = new Date()): Promise<AwardResult> {
  const today = localDateString(now);
  const result = await withProfileSettings((settings) => {
    const bucket = todayBucket(settings.coinsToday, today);
    if (bucket.deckCompletions.includes(deckId)) {
      return {
        next: { ...settings, coinsToday: bucket },
        result: {
          awarded: 0,
          balance: settings.coins ?? 0,
          reachedCap: bucket.total >= DAILY_COIN_CAP,
        } satisfies AwardResult,
      };
    }
    const remainingCap = DAILY_COIN_CAP - bucket.total;
    const givable = Math.min(DECK_COMPLETE_BONUS, Math.max(0, remainingCap));
    bucket.deckCompletions.push(deckId);
    bucket.total += givable;
    const balance = (settings.coins ?? 0) + givable;
    return {
      next: {
        ...settings,
        coins: balance,
        coinsToday: bucket,
      },
      result: {
        awarded: givable,
        balance,
        reachedCap: bucket.total >= DAILY_COIN_CAP,
      } satisfies AwardResult,
    };
  });
  if (!result) return { awarded: 0, balance: 0, reachedCap: false };
  if (result.awarded > 0) await bumpVersion("deck-complete bonus");
  return result;
}

// Spend coins (theme purchases etc.). Returns success/failure atomically
// so a slow UI can't double-spend by clicking twice.
export async function spendCoins(amount: number): Promise<{ ok: boolean; balance: number }> {
  if (amount <= 0) {
    const p = await db.profile.get("self");
    return { ok: true, balance: p?.settings.coins ?? 0 };
  }
  const result = await withProfileSettings((settings) => {
    const current = settings.coins ?? 0;
    if (current < amount) {
      return {
        next: settings,
        result: { ok: false, balance: current },
      };
    }
    return {
      next: { ...settings, coins: current - amount },
      result: { ok: true, balance: current - amount },
    };
  });
  if (result && result.ok) await bumpVersion("coins spent");
  return result ?? { ok: false, balance: 0 };
}

// Used by the shop "balance" pill and dialogs.
export function currentBalance(
  settings: import("../db/types").ProfileSettings | undefined,
): number {
  return settings?.coins ?? 0;
}

// Debug helper used by the COINMAX cheat code.
export async function setCoinBalance(amount: number): Promise<void> {
  await withProfileSettings((settings) => ({
    next: { ...settings, coins: Math.max(0, amount) },
    result: undefined,
  }));
  await bumpVersion("coin balance override");
}

export function coinsRemainingToday(settings: import("../db/types").ProfileSettings | undefined): number {
  if (!settings) return DAILY_COIN_CAP;
  const today = localDateString();
  if (!settings.coinsToday || settings.coinsToday.date !== today) {
    return DAILY_COIN_CAP;
  }
  return Math.max(0, DAILY_COIN_CAP - settings.coinsToday.total);
}
