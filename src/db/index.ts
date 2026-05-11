// Public surface of the data layer. Components import from "@/db" only; raw
// Dexie usage outside this directory is a code smell.
export * from "./types";
export { db } from "./schema";
export {
  ensureProfile,
  bumpVersion,
  updateSettings,
  markBackupSaved,
  useProfile,
} from "./profile";
export {
  DECK_COLOURS,
  createDeck,
  getDeck,
  listDecks,
  listRootDecks,
  listChildDecks,
  updateDeck,
  deleteDeck,
  moveDeck,
  duplicateDeck,
  getDeckDepth,
  collectDescendantIds,
  walkAncestorsInclusive,
  walkAncestorsExclusive,
  useDecks,
  useDeck,
} from "./decks";
export {
  createCard,
  getCard,
  listCardsInDeck,
  listCardsInDecks,
  listCardsByTag,
  countDueCards,
  bulkCopyCardsToDeck,
  updateCard,
  moveCard,
  deleteCard,
  listAllTags,
  useCardsInDeck,
  useCard,
} from "./cards";
export {
  getMedia,
  storeMedia,
  retainMedia,
  releaseMedia,
  sweepOrphanedMedia,
  totalMediaBytes,
} from "./media";
export {
  addReviewEvent,
  listReviewsForCard,
  listReviewsForSession,
  listReviewsSince,
} from "./reviews";
export {
  recordSession,
  listRecentSessions,
  listSessionsInRange,
} from "./sessions";
export { seedDevData } from "./seed";
export { seedDebugData, wipeAllData } from "./seed-debug";
export type { SeedDebugResult } from "./seed-debug";

export type { CreateDeckInput } from "./decks";
export type { CreateCardInput } from "./cards";
