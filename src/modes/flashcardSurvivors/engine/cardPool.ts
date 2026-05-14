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

// Card → enemy mapping (Survivors-Spec §2.4) — extended.
//
// Speed is now reading-time-aware: the longer the card's front (to read)
// and back (to type), the slower the enemy. Without this, language vocab
// with 30+ char fronts was unplayably fast — the original flat speed
// curve gave students 4-6 seconds to read AND type, which is hopeless.
//
// Formula:
//   1. Estimate reading time = max(2s, (frontChars + backChars*1.5) / 8)
//      (8 chars/sec is leisurely reading; back is weighted 1.5x because
//      typing it takes longer than scanning the front).
//   2. Pick a base speed that gives the student that reading time + a
//      40% buffer before the enemy reaches the centre, assuming a ~500px
//      edge-to-centre distance. baseSpeed = 500 / (readingTime * 1.4).
//   3. Modulate by retrievability — forgotten cards (low R) rush 1.4x.
//   4. Apply difficulty's enemySpeedMult on top in the engine.
//
// Difficulty / retrievability / lapses are read out of the FSRS state.
// ts-fsrs stores these on the card's fsrs blob. The accesses below tolerate
// undefined fields so brand-new cards still produce sensible enemies.

const EDGE_TO_CENTRE_PX = 500; // canvas-edge-ish distance the enemy traverses
const READING_BUFFER = 1.4; // 40% extra time on top of reading-time estimate
const MIN_SPEED = 12; // hard floor — even on tiny cards, slow enough to type
const MAX_SPEED = 70; // hard ceiling — even on tiny cards, never bullet-speed
// Global "this is the slow / readable era" knob. Multiplies the final
// speed out of the formula below. Tightening this dial is the right
// place to make every difficulty + every card-length slower / faster
// at the same time. The engine then layers a distance-based curve on
// top so the *arrival* phase still feels snappy.
const GLOBAL_SPEED_SCALE = 0.5;

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
  const retrievability =
    stability > 0 ? Math.max(0, Math.min(1, Math.exp(-elapsed / stability))) : 0.5;

  const frontText = cardFront(card);
  const backText = cardBack(card);
  const sizeBase = 28 + Math.min(20, backText.length * 0.6);
  const shapeIdx =
    [...card.id].reduce((s, c) => (s + c.charCodeAt(0)) % SHAPES.length, 0) %
    SHAPES.length;

  // Reading-time estimate. Floor at 2s so a one-letter answer still gives
  // a beat to react.
  const readingTimeSec = Math.max(
    2,
    (frontText.length + backText.length * 1.5) / 8,
  );
  // Speed that delivers the enemy to the centre right when the reading
  // buffer expires.
  const reactionSpeed = EDGE_TO_CENTRE_PX / (readingTimeSec * READING_BUFFER);
  // Forgotten cards rush in faster (low R), well-known ones drift in
  // slowly. retrievability of 0 -> 1.4x, retrievability of 1 -> 0.7x.
  const rMult = 0.7 + (1 - retrievability) * 0.7;
  const speed = Math.max(
    MIN_SPEED,
    Math.min(MAX_SPEED, reactionSpeed * rMult * GLOBAL_SPEED_SCALE),
  );

  return {
    hp: Math.round(10 + difficulty * 8),
    speed,
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
// input. Spec §2.6.1 calls for case + whitespace normalisation; we
// additionally strip diacritics so language-deck students can type
// `etre` for `être`, `manana` for `mañana`, `schon` for `schön`.
// Otherwise the mode is unplayable on any deck whose answers contain
// accents — students on a Bluetooth keyboard can't easily produce the
// combining marks.
//
// Mechanism:
//   1. Lowercase + trim + collapse multi-whitespace.
//   2. Unicode NFD decomposition: each precomposed accented character
//      becomes a base letter + a combining mark (e.g. é -> e + U+0301).
//      We then strip everything in the combining-marks range. This
//      covers French, Spanish, Portuguese, Italian, Vietnamese, etc.
//   3. Manual mappings for characters NFD doesn't decompose — German
//      ß -> ss, Scandinavian ø/Ø -> o, Polish ł -> l, ligatures
//      æ/œ -> ae/oe, Icelandic þ/ð -> th/d. These are the standard
//      romanisation rules students would expect.
//
// The same normalisation is used on both sides of every comparison
// (typed input + stored card back), so equality checks remain symmetric.
const ROMANISATION_MAP: Record<string, string> = {
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ł: "l",
  þ: "th",
  ð: "d",
};

export function normaliseAnswer(s: string): string {
  let out = s.trim().toLowerCase().replace(/\s+/g, " ");
  // NFD splits accented forms into base + combining mark; strip marks
  // (Unicode block U+0300–U+036F: combining diacritical marks).
  out = out.normalize("NFD").replace(/[̀-ͯ]/g, "");
  // Manual single-character mappings for non-decomposing characters.
  let rebuilt = "";
  for (const ch of out) {
    rebuilt += ROMANISATION_MAP[ch] ?? ch;
  }
  return rebuilt;
}

export function cardBack(card: Card): string {
  if (card.content.type === "basic") return card.content.back.text;
  return "";
}

export function cardFront(card: Card): string {
  if (card.content.type === "basic") return card.content.front.text;
  return "";
}
