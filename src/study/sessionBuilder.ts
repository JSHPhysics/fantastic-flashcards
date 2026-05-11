// Builds the queue of cards for a study session. Reviews come first (sorted
// by due date ascending - the oldest overdue first), then up to N new cards
// per the deck's daily limits.

import {
  collectDescendantIds,
  listCardsInDecks,
  type Card,
} from "../db";
import { dueMs, isNewCard } from "../srs/scheduler";

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

  const reviews: Card[] = [];
  const news: Card[] = [];
  for (const c of active) {
    if (isNewCard(c.fsrs)) {
      news.push(c);
    } else if (dueMs(c.fsrs) <= now) {
      reviews.push(c);
    }
  }

  reviews.sort((a, b) => dueMs(a.fsrs) - dueMs(b.fsrs));
  news.sort((a, b) => a.createdAt - b.createdAt);

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
