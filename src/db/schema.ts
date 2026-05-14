import Dexie, { type Table } from "dexie";
import type {
  Profile,
  Deck,
  Card,
  MediaBlob,
  ReviewEvent,
  Session,
  SurvivorRun,
  SurvivorStats,
  SurvivorMastery,
} from "./types";

// IndexedDB schema for FantasticFlashcards.
// Multi-entry index `*tags` on cards drives fast tag filtering (Playbook 3).
// Indexed fields are chosen by access pattern; non-indexed fields stay flexible.
//
// Version 2 adds three Flashcard Survivors tables (runs / stats / mastery).
// Dexie auto-migrates from v1 — existing data is preserved, the new tables
// start empty.
export class FantasticFlashcardsDB extends Dexie {
  profile!: Table<Profile, "self">;
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  media!: Table<MediaBlob, string>;
  reviews!: Table<ReviewEvent, string>;
  sessions!: Table<Session, string>;
  // Flashcard Survivors persistence (Survivors-Spec §2.13).
  survivorRuns!: Table<SurvivorRun, string>;
  survivorStats!: Table<SurvivorStats, "self">;
  survivorMastery!: Table<SurvivorMastery, "self">;

  constructor() {
    super("fantastic-flashcards");
    this.version(1).stores({
      profile: "id",
      decks: "id, parentId, name, updatedAt",
      cards: "id, deckId, type, updatedAt, *tags, generatedFromCardId",
      media: "hash, refCount, bytes",
      reviews: "id, cardId, deckId, sessionId, timestamp",
      sessions: "id, startedAt, endedAt",
    });
    this.version(2).stores({
      // Existing tables unchanged — Dexie carries them forward when version
      // bumps. Only the new tables need stores definitions here.
      survivorRuns: "id, startedAt, difficulty",
      survivorStats: "id",
      survivorMastery: "id",
    });
  }
}

export const db = new FantasticFlashcardsDB();
