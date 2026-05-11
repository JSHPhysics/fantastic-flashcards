// Wraps ts-fsrs with the small surface the rest of the app actually needs.
// Single configured fsrs instance with default parameters; we can tune the
// parameters per-user later if we expose them.

import {
  createEmptyCard,
  fsrs as makeFsrs,
  generatorParameters,
} from "ts-fsrs";
import type { Card as FsrsCard, ReviewLog } from "ts-fsrs";
import type { Rating, FsrsState } from "../db/types";

const fsrsInstance = makeFsrs(generatorParameters());

export function initFsrsState(now: Date = new Date()): FsrsState {
  return createEmptyCard(now);
}

export interface ApplyResult {
  next: FsrsState;
  log: ReviewLog;
}

// Given a card's current FSRS state and a 1-4 rating, return the state for
// the next scheduled review. ts-fsrs's `next` returns the single chosen
// result for the supplied rating.
export function applyRating(
  state: FsrsState,
  rating: Rating,
  now: Date = new Date(),
): ApplyResult {
  const result = fsrsInstance.next(state as FsrsCard, now, rating);
  return { next: result.card, log: result.log };
}

export function dueMs(state: FsrsState): number {
  return state.due instanceof Date
    ? state.due.getTime()
    : new Date(state.due).getTime();
}

export function cardIsDue(state: FsrsState, now: Date = new Date()): boolean {
  return dueMs(state) <= now.getTime();
}

// "New" = never been through a review pass. ts-fsrs marks new cards with
// reps === 0 and state === 0 (New).
export function isNewCard(state: FsrsState): boolean {
  return state.reps === 0;
}
