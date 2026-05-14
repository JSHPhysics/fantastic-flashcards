// Pulls cards for the run from the existing FSRS queue.
//
// Filter: basic cards only (Survivors-Spec §2.3 — non-basic types are
// skipped silently). We don't touch the FSRS state of cards reviewed in
// this mode (engagement mode, not canonical review — §1).
//
// Fallback order if the due queue is empty:
//   1. Due-or-due-soon basic cards in selected decks
//   2. Any basic cards in selected decks
// Never blocks the spawner.

import type { Card } from "../../../db";
import { db } from "../../../db/schema";
import { cardIsDue } from "../../../srs/scheduler";

export interface CardPoolStats {
  hp: number;
  speed: number; // base units / sec — engine scales by canvas
  contactDamage: number;
  size: number;
  colour: string;
  shape: "circle" | "triangle" | "square" | "diamond" | "hex" | "pentagon";
}

const SHAPES: CardPoolStats["shape"][] = [
  "circle",
  "triangle",
  "square",
  "diamond",
  "hex",
  "pentagon",
];

// Card → enemy mapping (Survivors-Spec §2.4).
//
// Difficulty / retrievability / lapses are read out of the FSRS state.
// ts-fsrs stores these on the card's fsrs blob. The accesses below tolerate
// undefined fields so brand-new cards still produce sensible enemies.
export function statsForCard(card: Card, deckColour: string): CardPoolStats {
  const fsrs = card.fsrs as {
    difficulty?: number;
    stability?: number;
    elapsed_days?: number;
    lapses?: number;
  };
  const difficulty = fsrs.difficulty ?? 5; // 1..10 range from ts-fsrs
  const stability = fsrs.stability ?? 1;
  const elapsed = fsrs.elapsed_days ?? 0;
  const lapses = fsrs.lapses ?? 0;
  // Retrievability = exp(-elapsed / stability) clamped — fresh new cards
  // get treated as R = 0.5 baseline so they're not full-speed.
  const retrievability =
    stability > 0 ? Math.max(0, Math.min(1, Math.exp(-elapsed / stability))) : 0.5;
  // Back text drives card size — longer answers = bigger, more telegraphed.
  const backText =
    card.content.type === "basic" ? card.content.back.text : "";
  const sizeBase = 28 + Math.min(20, backText.length * 0.6);
  // Hash card id to a stable shape so the same card always renders the same.
  const shapeIdx =
    [...card.id].reduce((s, c) => (s + c.charCodeAt(0)) % SHAPES.length, 0) %
    SHAPES.length;
  return {
    hp: Math.round(10 + difficulty * 8),
    // Speed: low R = faster. 60..160 px/s range at the engine layer.
    speed: 60 + (1 - retrievability) * 100,
    contactDamage: 8 + lapses * 3,
    size: sizeBase,
    colour: deckColour,
    shape: SHAPES[shapeIdx],
  };
}

// Loads + filters cards for a run. Caches the queue in memory; refilled by
// the engine as cards are killed.
export async function buildSurvivorPool(deckIds: string[]): Promise<Card[]> {
  if (deckIds.length === 0) return [];
  const all = await db.cards.where("deckId").anyOf(deckIds).toArray();
  const basics = all.filter((c) => c.type === "basic" && !c.suspended);
  if (basics.length === 0) return [];

  const now = new Date();
  const due = basics.filter((c) => cardIsDue(c.fsrs, now));
  if (due.length >= 8) return shuffle(due);

  // Pad with non-due basics so the spawner never starves.
  const fillers = basics.filter((c) => !due.includes(c));
  return shuffle([...due, ...shuffle(fillers)]);
}

// Returns true when the deck combination has the minimum basic-card count
// required for Tap Mode to be playable (Survivors-Spec §2.6.2: needs >= 4
// basic cards for the 4-choice tray).
export async function countBasicCardsInDecks(
  deckIds: string[],
): Promise<number> {
  if (deckIds.length === 0) return 0;
  const all = await db.cards.where("deckId").anyOf(deckIds).toArray();
  return all.filter((c) => c.type === "basic" && !c.suspended).length;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Normalised version of a card's back text for comparison against typed
// input. Matches whitespace-and-case-insensitive equality per spec §2.6.1.
export function normaliseAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function cardBack(card: Card): string {
  if (card.content.type === "basic") return card.content.back.text;
  return "";
}

export function cardFront(card: Card): string {
  if (card.content.type === "basic") return card.content.front.text;
  return "";
}
