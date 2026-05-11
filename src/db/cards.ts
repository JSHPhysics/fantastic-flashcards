import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./schema";
import { bumpVersion } from "./profile";
import { newId } from "./ids";
import { initFsrsState } from "../srs/state";
import { walkAncestorsInclusive } from "./decks";
import { retainMedia, releaseMedia } from "./media";
import {
  diffHashes,
  hashesInContent,
} from "../cards/media-lifecycle";
import type { Card, CardContent, CardType } from "./types";

// Recompute deck.mediaBytes by summing bytes of unique media hashes referenced
// by every card in the deck (suspended cards still take up storage, so they
// count). O(cards + hashes); runs after each mutation that touches a deck.
// Cheap enough at deck-size scale.
async function recomputeDeckMediaBytes(deckId: string): Promise<void> {
  const cards = await db.cards.where("deckId").equals(deckId).toArray();
  const hashes = new Set<string>();
  for (const c of cards) {
    for (const h of hashesInContent(c.content)) hashes.add(h);
  }
  if (hashes.size === 0) {
    await db.decks.update(deckId, { mediaBytes: 0 });
    return;
  }
  let total = 0;
  for (const h of hashes) {
    const m = await db.media.get(h);
    if (m) total += m.bytes;
  }
  await db.decks.update(deckId, { mediaBytes: total });
}

export interface CreateCardInput {
  deckId: string;
  type: CardType;
  tags: string[];
  content: CardContent;
  generatedFromCardId?: string;
}

export async function createCard(input: CreateCardInput): Promise<Card> {
  const now = Date.now();
  const card: Card = {
    id: newId(),
    deckId: input.deckId,
    type: input.type,
    tags: dedupeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    content: input.content,
    fsrs: initFsrsState(new Date(now)),
    suspended: false,
    generatedFromCardId: input.generatedFromCardId,
  };
  await db.transaction("rw", db.cards, db.decks, async () => {
    await db.cards.add(card);
    const ownDeck = await db.decks.get(card.deckId);
    if (ownDeck) {
      await db.decks.update(card.deckId, {
        cardCount: ownDeck.cardCount + 1,
        updatedAt: now,
      });
    }
    await walkAncestorsInclusive(card.deckId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount + 1,
      });
    });
  });
  // Retain referenced media outside the cards/decks transaction so we don't
  // mix tables. Each retain is atomic on its own.
  for (const h of hashesInContent(card.content)) {
    await retainMedia(h);
  }
  await recomputeDeckMediaBytes(card.deckId);
  await bumpVersion("card created");
  return card;
}

export async function getCard(id: string): Promise<Card | undefined> {
  return db.cards.get(id);
}

export async function listCardsInDeck(deckId: string): Promise<Card[]> {
  return db.cards.where("deckId").equals(deckId).toArray();
}

export async function listCardsInDecks(deckIds: string[]): Promise<Card[]> {
  if (deckIds.length === 0) return [];
  return db.cards.where("deckId").anyOf(deckIds).toArray();
}

// Count cards due (fsrs.due <= now) in a deck. Used for the due-today badge.
// Includes descendants if a descendant id list is supplied.
export async function countDueCards(
  deckIds: string[],
  now: Date = new Date(),
): Promise<number> {
  if (deckIds.length === 0) return 0;
  const cards = await db.cards.where("deckId").anyOf(deckIds).toArray();
  const ts = now.getTime();
  let due = 0;
  for (const c of cards) {
    if (c.suspended) continue;
    const dueAt =
      c.fsrs.due instanceof Date ? c.fsrs.due.getTime() : new Date(c.fsrs.due).getTime();
    if (dueAt <= ts) due += 1;
  }
  return due;
}

export async function listCardsByTag(
  tags: string[],
  mode: "any" | "all",
): Promise<Card[]> {
  if (tags.length === 0) return [];
  if (mode === "any") {
    return db.cards.where("tags").anyOf(tags).distinct().toArray();
  }
  // ALL mode: intersect by filtering candidate ids
  const candidates = await db.cards
    .where("tags")
    .anyOf(tags)
    .distinct()
    .toArray();
  return candidates.filter((c) => tags.every((t) => c.tags.includes(t)));
}

export async function updateCard(
  id: string,
  patch: Partial<Omit<Card, "id" | "createdAt" | "deckId">>,
): Promise<void> {
  const next = { ...patch, updatedAt: Date.now() };
  if (next.tags) next.tags = dedupeTags(next.tags);

  // If content changed, reconcile media refs.
  if (patch.content !== undefined) {
    const before = await db.cards.get(id);
    if (before) {
      const { added, removed } = diffHashes(
        hashesInContent(before.content),
        hashesInContent(patch.content),
      );
      for (const h of added) await retainMedia(h);
      for (const h of removed) await releaseMedia(h);
      await db.cards.update(id, next);
      await recomputeDeckMediaBytes(before.deckId);
      await bumpVersion("card updated");
      return;
    }
  }
  await db.cards.update(id, next);
  await bumpVersion("card updated");
}

// Moves a card to a different deck and reconciles all four count fields.
export async function moveCard(
  cardId: string,
  toDeckId: string,
): Promise<void> {
  let fromDeckId: string | undefined;
  await db.transaction("rw", db.cards, db.decks, async () => {
    const card = await db.cards.get(cardId);
    if (!card || card.deckId === toDeckId) return;
    fromDeckId = card.deckId;

    await db.cards.update(cardId, { deckId: toDeckId, updatedAt: Date.now() });

    const fromDeck = await db.decks.get(card.deckId);
    if (fromDeck) {
      await db.decks.update(card.deckId, {
        cardCount: fromDeck.cardCount - 1,
      });
    }
    const toDeck = await db.decks.get(toDeckId);
    if (toDeck) {
      await db.decks.update(toDeckId, {
        cardCount: toDeck.cardCount + 1,
      });
    }
    await walkAncestorsInclusive(card.deckId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount - 1,
      });
    });
    await walkAncestorsInclusive(toDeckId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount + 1,
      });
    });
  });
  if (fromDeckId) await recomputeDeckMediaBytes(fromDeckId);
  await recomputeDeckMediaBytes(toDeckId);
  await bumpVersion("card moved");
}

// Bulk-copy cards into a new deck. Used by the recursive deck duplicate flow.
// Returns the count of created cards. New cards get fresh FSRS state so the
// duplicated deck behaves as new material for the scheduler.
export async function bulkCopyCardsToDeck(
  sourceDeckId: string,
  targetDeckId: string,
): Promise<number> {
  const sources = await db.cards
    .where("deckId")
    .equals(sourceDeckId)
    .toArray();
  if (sources.length === 0) return 0;

  const now = Date.now();
  const copies: Card[] = sources.map((c) => ({
    id: newId(),
    deckId: targetDeckId,
    type: c.type,
    tags: c.tags.slice(),
    createdAt: now,
    updatedAt: now,
    content: structuredClone(c.content),
    fsrs: initFsrsState(new Date(now)),
    suspended: false,
  }));

  await db.transaction("rw", db.cards, db.decks, async () => {
    await db.cards.bulkAdd(copies);
    const dest = await db.decks.get(targetDeckId);
    if (dest) {
      await db.decks.update(targetDeckId, {
        cardCount: dest.cardCount + copies.length,
        updatedAt: now,
      });
    }
    await walkAncestorsInclusive(targetDeckId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount + copies.length,
      });
    });
  });
  // Each copy adds a reference to the same media hashes.
  for (const c of copies) {
    for (const h of hashesInContent(c.content)) await retainMedia(h);
  }
  await recomputeDeckMediaBytes(targetDeckId);
  await bumpVersion("cards duplicated");
  return copies.length;
}

export async function deleteCard(id: string): Promise<void> {
  const touchedDecks = new Set<string>();
  const releasedHashes: string[] = [];

  await db.transaction("rw", db.cards, db.decks, async () => {
    const card = await db.cards.get(id);
    if (!card) return;

    // Cascade delete of auto-reverse siblings: any card with
    // generatedFromCardId === this card's id (Playbook 3 auto-reverse rule).
    const generated = await db.cards
      .where("generatedFromCardId")
      .equals(id)
      .toArray();
    const allIds = [id, ...generated.map((c) => c.id)];

    const allCards = [card, ...generated];
    const perDeck = new Map<string, number>();
    for (const c of allCards) {
      perDeck.set(c.deckId, (perDeck.get(c.deckId) ?? 0) + 1);
      for (const h of hashesInContent(c.content)) releasedHashes.push(h);
      touchedDecks.add(c.deckId);
    }

    await db.cards.bulkDelete(allIds);

    for (const [deckId, count] of perDeck) {
      const d = await db.decks.get(deckId);
      if (d) {
        await db.decks.update(deckId, { cardCount: d.cardCount - count });
      }
      await walkAncestorsInclusive(deckId, async (anc) => {
        await db.decks.update(anc.id, {
          descendantCardCount: anc.descendantCardCount - count,
        });
      });
    }
  });

  for (const h of releasedHashes) await releaseMedia(h);
  for (const deckId of touchedDecks) await recomputeDeckMediaBytes(deckId);
  await bumpVersion("card deleted");
}

// All tags ever used. Backed by the cards.tags multi-entry index.
export async function listAllTags(): Promise<string[]> {
  const keys = (await db.cards.orderBy("tags").uniqueKeys()) as string[];
  return keys;
}

export function useCardsInDeck(deckId: string | undefined): Card[] | undefined {
  return useLiveQuery(async (): Promise<Card[]> => {
    if (!deckId) return [];
    return db.cards.where("deckId").equals(deckId).toArray();
  }, [deckId]);
}

export function useCard(id: string | undefined): Card | undefined {
  return useLiveQuery(async (): Promise<Card | undefined> => {
    if (!id) return undefined;
    return db.cards.get(id);
  }, [id]);
}

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}
