import { createEmptyCard } from "ts-fsrs";
import type { FsrsState } from "../db/types";

// Wraps ts-fsrs so the rest of the app uses our own FsrsState alias.
// Session 10 builds the full scheduler around this.
export function initFsrsState(now: Date = new Date()): FsrsState {
  return createEmptyCard(now);
}
