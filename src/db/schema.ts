import Dexie, { type Table } from "dexie";
import type {
  Profile,
  Deck,
  Card,
  MediaBlob,
  ReviewEvent,
  Session,
} from "./types";

// IndexedDB schema for FantasticFlashcards.
// Multi-entry index `*tags` on cards drives fast tag filtering (Playbook 3).
// Indexed fields are chosen by access pattern; non-indexed fields stay flexible.
export class FantasticFlashcardsDB extends Dexie {
  profile!: Table<Profile, "self">;
  decks!: Table<Deck, string>;
  cards!: Table<Card, string>;
  media!: Table<MediaBlob, string>;
  reviews!: Table<ReviewEvent, string>;
  sessions!: Table<Session, string>;

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
  }
}

export const db = new FantasticFlashcardsDB();
