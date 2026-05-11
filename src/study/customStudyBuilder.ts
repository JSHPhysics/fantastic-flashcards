// Builds the queue for a Custom Study session. Order of filters applies:
//   1. Resolve deck ids (optionally expanding to descendants).
//   2. Load all non-suspended cards across those decks.
//   3. Filter by card type if a type filter was given.
//   4. Filter by tags (any / all).
//   5. Filter to only cards the user rated Again or Hard in the last N days
//      (the "recent mistakes" preset).
//   6. Optionally shuffle.
//   7. Cap at maxCards.

import {
  collectDescendantIds,
  listCardsInDecks,
  type Card,
  type CustomStudyConfig,
} from "../db";
import { db } from "../db/schema";

export interface CustomSessionQueue {
  cards: Card[];
  totalMatched: number;
  capped: boolean;
  deckIds: string[];
}

export async function buildCustomStudySession(
  config: CustomStudyConfig,
  now: Date = new Date(),
): Promise<CustomSessionQueue> {
  const deckIds = await expandDeckIds(
    config.deckIds,
    config.includeSubDecks,
  );
  if (deckIds.length === 0) {
    return { cards: [], totalMatched: 0, capped: false, deckIds };
  }

  const all = await listCardsInDecks(deckIds);
  let cards = all.filter((c) => !c.suspended);

  if (config.cardTypeFilter && config.cardTypeFilter.length > 0) {
    const allowed = new Set(config.cardTypeFilter);
    cards = cards.filter((c) => allowed.has(c.type));
  }

  if (config.tagFilter && config.tagFilter.tags.length > 0) {
    const wanted = config.tagFilter.tags;
    if (config.tagFilter.mode === "all") {
      cards = cards.filter((c) => wanted.every((t) => c.tags.includes(t)));
    } else {
      const wantedSet = new Set(wanted);
      cards = cards.filter((c) => c.tags.some((t) => wantedSet.has(t)));
    }
  }

  if (config.recentMistakes) {
    const cutoff =
      now.getTime() - config.recentMistakes.withinDays * 24 * 60 * 60 * 1000;
    const mistakes = await db.reviews
      .where("timestamp")
      .aboveOrEqual(cutoff)
      .toArray();
    const struggleCardIds = new Set<string>();
    for (const r of mistakes) {
      if (r.rating <= 2) struggleCardIds.add(r.cardId);
    }
    cards = cards.filter((c) => struggleCardIds.has(c.id));
  }

  const totalMatched = cards.length;

  if (config.shuffle) {
    cards = shuffleArray(cards);
  } else {
    // Stable-ish order: by deck name then card createdAt. The session feels
    // natural this way: cards in deck A grouped together, oldest first.
    cards.sort((a, b) =>
      a.deckId === b.deckId
        ? a.createdAt - b.createdAt
        : a.deckId.localeCompare(b.deckId),
    );
  }

  const capped = cards.length > config.maxCards;
  cards = cards.slice(0, Math.max(0, config.maxCards));

  return { cards, totalMatched, capped, deckIds };
}

async function expandDeckIds(
  initial: string[],
  includeSubDecks: boolean,
): Promise<string[]> {
  if (!includeSubDecks) return initial;
  const expanded = new Set<string>();
  for (const id of initial) {
    const descendants = await collectDescendantIds(id);
    for (const d of descendants) expanded.add(d);
  }
  return [...expanded];
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Look up the most recent custom-study config so the setup screen can offer
// a "Repeat last custom study" preset. mode isn't indexed; we load the most
// recent few sessions and pick the first with a customStudyConfig.
export async function loadLastCustomStudyConfig(): Promise<
  CustomStudyConfig | null
> {
  const recent = await db.sessions
    .orderBy("startedAt")
    .reverse()
    .limit(50)
    .toArray();
  const found = recent.find(
    (s) => s.mode === "custom-study" && s.customStudyConfig,
  );
  return found?.customStudyConfig ?? null;
}
