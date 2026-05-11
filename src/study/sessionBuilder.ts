// Builds the queue of cards for a study session. Reviews come first then up
// to N new cards per the deck's daily limits. Within each bucket the order
// is shuffled so auto-reverse siblings (and any other adjacent-in-creation
// pairs) don't land next to each other - studying two halves of the same
// pair back-to-back is tedious and gives the student a free hint.
//
// FSRS doesn't require strict due-date priority within "everything due
// now"; shuffling is a common pattern in mature SRS apps.

import {
  collectDescendantIds,
  listCardsInDecks,
  type Card,
} from "../db";
import { isNewCard, cardIsDue } from "../srs/scheduler";

export interface SessionBuilderInput {
  rootDeckId: string;
  includeSubDecks: boolean;
  newCardLimit: number;
  reviewLimit: number;
  now?: Date;
}

export interface SessionQueue {
  cards: Card[];
  reviewCount: number;
  newCount: number;
  deckIds: string[];
  // Cards that were due but exceeded the limit. Surfaced in the summary so
  // the student knows there's more waiting.
  reviewsRemaining: number;
  newRemaining: number;
}

export async function buildStandardSession(
  input: SessionBuilderInput,
): Promise<SessionQueue> {
  const now = (input.now ?? new Date()).getTime();
  const deckIds = input.includeSubDecks
    ? await collectDescendantIds(input.rootDeckId)
    : [input.rootDeckId];

  const all = await listCardsInDecks(deckIds);
  const active = all.filter((c) => !c.suspended);
  const nowDate = new Date(now);

  const reviews: Card[] = [];
  const news: Card[] = [];
  for (const c of active) {
    if (isNewCard(c.fsrs)) {
      news.push(c);
    } else if (cardIsDue(c.fsrs, nowDate)) {
      reviews.push(c);
    }
  }

  // Shuffle within each bucket. Reviews still come before news in the final
  // queue, but adjacent-in-creation pairs (auto-reverse siblings,
  // bulk-imported neighbours, cloze fan-outs) get mixed up.
  shuffleInPlace(reviews);
  shuffleInPlace(news);

  const limitedReviews = reviews.slice(0, input.reviewLimit);
  const limitedNew = news.slice(0, input.newCardLimit);

  return {
    cards: [...limitedReviews, ...limitedNew],
    reviewCount: limitedReviews.length,
    newCount: limitedNew.length,
    deckIds,
    reviewsRemaining: Math.max(0, reviews.length - limitedReviews.length),
    newRemaining: Math.max(0, news.length - limitedNew.length),
  };
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
