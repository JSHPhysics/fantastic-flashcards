import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./schema";
import { bumpVersion } from "./profile";
import { newId } from "./ids";
import { bulkCopyCardsToDeck } from "./cards";
import { releaseMedia } from "./media";
import { hashesInContent } from "../cards/media-lifecycle";
import type { Deck } from "./types";

// Curated palette for the deck-create colour picker (Playbook 8). Tokens.ts
// holds the brand palette; these are the user-facing deck swatch options.
export const DECK_COLOURS = [
  "#1E3A5F",
  "#C9A14A",
  "#3E8E63",
  "#3D7AB8",
  "#C44545",
  "#7A5BA8",
];

export type CreateDeckInput = Omit<
  Deck,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "cardCount"
  | "descendantCardCount"
  | "mediaBytes"
>;

export async function createDeck(input: CreateDeckInput): Promise<Deck> {
  const now = Date.now();
  const deck: Deck = {
    ...input,
    id: newId(),
    createdAt: now,
    updatedAt: now,
    cardCount: 0,
    descendantCardCount: 0,
    mediaBytes: 0,
  };
  await db.decks.add(deck);
  await bumpVersion("deck created");
  return deck;
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  return db.decks.get(id);
}

export async function listDecks(): Promise<Deck[]> {
  return db.decks.toArray();
}

export async function listRootDecks(): Promise<Deck[]> {
  const all = await db.decks.toArray();
  return all.filter((d) => !d.parentId);
}

export async function listChildDecks(parentId: string): Promise<Deck[]> {
  return db.decks.where("parentId").equals(parentId).toArray();
}

export async function updateDeck(
  id: string,
  patch: Partial<Omit<Deck, "id" | "createdAt">>,
): Promise<void> {
  await db.decks.update(id, { ...patch, updatedAt: Date.now() });
  await bumpVersion("deck updated");
}

// Depth from root, 1-indexed. Root deck = depth 1.
// Used by the Session 3 modal at depth > 4.
export async function getDeckDepth(id: string): Promise<number> {
  let depth = 1;
  let current = await db.decks.get(id);
  while (current?.parentId) {
    depth += 1;
    current = await db.decks.get(current.parentId);
  }
  return depth;
}

// Descendant IDs including self, used by recursive delete and move-target filter.
export async function collectDescendantIds(rootId: string): Promise<string[]> {
  const ids: string[] = [rootId];
  const queue: string[] = [rootId];
  while (queue.length) {
    const parentId = queue.shift()!;
    const children = await db.decks
      .where("parentId")
      .equals(parentId)
      .toArray();
    for (const child of children) {
      ids.push(child.id);
      queue.push(child.id);
    }
  }
  return ids;
}

// Recursive duplicate. Copies the subtree rooted at sourceId under the chosen
// new parent and copies every card. Cards get fresh FSRS state via
// bulkCopyCardsToDeck. Name suffixed "(copy)" on the root copy only.
export async function duplicateDeck(
  sourceId: string,
  newParentId?: string,
): Promise<Deck | undefined> {
  const original = await db.decks.get(sourceId);
  if (!original) return undefined;

  // Build the source subtree breadth-first so we copy parents before children.
  const subtree: Deck[] = [];
  const queue: string[] = [sourceId];
  while (queue.length) {
    const id = queue.shift()!;
    const d = await db.decks.get(id);
    if (!d) continue;
    subtree.push(d);
    const children = await db.decks.where("parentId").equals(id).toArray();
    for (const c of children) queue.push(c.id);
  }

  const idMap = new Map<string, string>();
  let rootCopy: Deck | undefined;
  const now = Date.now();
  for (const src of subtree) {
    const targetId = newId();
    idMap.set(src.id, targetId);

    const copy: Deck = {
      ...src,
      id: targetId,
      parentId:
        src.id === sourceId ? newParentId : idMap.get(src.parentId ?? ""),
      name: src.id === sourceId ? `${src.name} (copy)` : src.name,
      cardCount: 0,
      descendantCardCount: 0,
      mediaBytes: 0,
      createdAt: now,
      updatedAt: now,
    };
    await db.decks.add(copy);
    if (src.id === sourceId) rootCopy = copy;
  }

  // Copy cards after the new deck tree is in place so descendant-count walks
  // along the new tree resolve correctly inside bulkCopyCardsToDeck.
  for (const src of subtree) {
    const targetId = idMap.get(src.id);
    if (targetId) await bulkCopyCardsToDeck(src.id, targetId);
  }

  await bumpVersion("deck duplicated");
  return rootCopy;
}

export async function deleteDeck(id: string): Promise<void> {
  const released: string[] = [];
  await db.transaction("rw", db.decks, db.cards, async () => {
    const all = await collectDescendantIds(id);
    const doomed = await db.cards.where("deckId").anyOf(all).toArray();
    for (const c of doomed) {
      for (const h of hashesInContent(c.content)) released.push(h);
    }
    await db.cards.where("deckId").anyOf(all).delete();
    await db.decks.bulkDelete(all);
  });
  // Release outside the cards/decks tx; the media GC sweep on next load
  // will clear orphaned blobs whose refCount drops to 0.
  for (const h of released) await releaseMedia(h);
  await bumpVersion("deck deleted");
}

// Re-parent. Recomputes descendantCardCount on both ancestor chains.
// Caller must guarantee newParentId is not the deck itself or a descendant
// (Session 3 UI enforces this).
export async function moveDeck(
  id: string,
  newParentId?: string,
): Promise<void> {
  await db.transaction("rw", db.decks, async () => {
    const deck = await db.decks.get(id);
    if (!deck) return;
    const oldParentId = deck.parentId;
    const moved = deck.descendantCardCount; // moves with the subtree

    await db.decks.update(id, {
      parentId: newParentId,
      updatedAt: Date.now(),
    });

    await walkAncestorsExclusive(oldParentId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount - moved,
      });
    });
    await walkAncestorsExclusive(newParentId, async (d) => {
      await db.decks.update(d.id, {
        descendantCardCount: d.descendantCardCount + moved,
      });
    });
  });
  await bumpVersion("deck moved");
}

// Walk strictly ancestors (excluding the start node) and apply fn.
// Defined here, not in cards.ts, so card mutations stay deck-agnostic.
export async function walkAncestorsExclusive(
  startParentId: string | undefined,
  fn: (deck: Deck) => Promise<void>,
): Promise<void> {
  let id: string | undefined = startParentId;
  while (id) {
    const deck: Deck | undefined = await db.decks.get(id);
    if (!deck) break;
    await fn(deck);
    id = deck.parentId;
  }
}

// Walk the deck itself plus all ancestors.
export async function walkAncestorsInclusive(
  startId: string,
  fn: (deck: Deck) => Promise<void>,
): Promise<void> {
  let id: string | undefined = startId;
  while (id) {
    const deck: Deck | undefined = await db.decks.get(id);
    if (!deck) break;
    await fn(deck);
    id = deck.parentId;
  }
}

export function useDecks(): Deck[] | undefined {
  return useLiveQuery(async (): Promise<Deck[]> => db.decks.toArray());
}

export function useDeck(id: string | undefined): Deck | undefined {
  return useLiveQuery(async (): Promise<Deck | undefined> => {
    if (!id) return undefined;
    return db.decks.get(id);
  }, [id]);
}
