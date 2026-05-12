// User-triggered "fill the app with stuff to play with" seed. Reached from
// Settings -> Debug -> Generate sample decks once debug mode is on. Distinct
// from the auto-run dev seed (src/db/seed.ts) which is intentionally tiny.
//
// Goal: a presentation-ready set that walks a stakeholder through every
// feature in a few minutes. Sub-decks, multiple card types, language pairs
// with the new baseLanguage redirect, varied tags, two weeks of review
// history so the Stats screen has charts.
//
// All decks created here are prefixed "[demo]" so the seeder can detect
// prior runs (idempotent) and so users can spot them at a glance.

import { db } from "./schema";
import { createDeck } from "./decks";
import {
  createBasicCard,
  createClozeCardSet,
  createMcqCard,
  createTypedCard,
} from "../cards/service";
import { newId } from "./ids";
import type { Card, FsrsState, ReviewEvent, Session, Rating } from "./types";

export interface SeedDebugResult {
  decksCreated: number;
  cardsCreated: number;
  alreadySeeded: boolean;
}

const DEBUG_PREFIX = "[demo]";
// The original seed used the `[debug]` prefix; treat either as a sign that
// the seeder has run, so a user who seeded under the old name doesn't end
// up with two copies after upgrading.
const LEGACY_DEBUG_PREFIX = "[debug]";

async function debugDecksExist(): Promise<boolean> {
  const all = await db.decks.toArray();
  return all.some(
    (d) =>
      d.name.startsWith(DEBUG_PREFIX) ||
      d.name.startsWith(LEGACY_DEBUG_PREFIX),
  );
}

export async function seedDebugData(): Promise<SeedDebugResult> {
  if (await debugDecksExist()) {
    return { decksCreated: 0, cardsCreated: 0, alreadySeeded: true };
  }

  let cards = 0;
  let decks = 0;

  // ---- Root: Languages (with three child decks: French, Spanish, German) ----

  const languagesRoot = await createDeck({
    name: `${DEBUG_PREFIX} Languages`,
    description:
      "Three language pairs — French, Spanish, German — each with its own sub-decks.",
    subject: "Languages",
    colour: "#C9A14A",
  });
  decks += 1;

  const french = await createDeck({
    name: "French",
    description: "fr-FR ↔ en-GB. Auto-pronounce always reads the French side.",
    subject: "French",
    colour: "#3D7AB8",
    parentId: languagesRoot.id,
    pronunciationLanguage: "fr-FR",
    secondaryLanguage: "en-GB",
    baseLanguage: "en-GB",
  });
  decks += 1;
  cards += await addLanguagePairCards(french.id, "fr-FR", "en-GB", [
    ["Greetings", ["fr", "vocab", "greetings"], [
      ["bonjour", "hello"],
      ["bonsoir", "good evening"],
      ["au revoir", "goodbye"],
      ["merci beaucoup", "thank you very much"],
      ["s'il vous plaît", "please (formal)"],
    ]],
    ["Numbers 1–10", ["fr", "vocab", "numbers", "beginner"], [
      ["un", "one"],
      ["deux", "two"],
      ["trois", "three"],
      ["quatre", "four"],
      ["cinq", "five"],
      ["six", "six"],
      ["sept", "seven"],
      ["huit", "eight"],
      ["neuf", "nine"],
      ["dix", "ten"],
    ]],
    ["Common verbs", ["fr", "vocab", "verbs", "tricky"], [
      ["être", "to be"],
      ["avoir", "to have"],
      ["aller", "to go"],
      ["faire", "to do / make"],
      ["pouvoir", "to be able to"],
      ["vouloir", "to want"],
    ]],
  ]);

  const spanish = await createDeck({
    name: "Spanish",
    description: "es-ES ↔ en-GB. Auto-pronounce always reads the Spanish side.",
    subject: "Spanish",
    colour: "#C44545",
    parentId: languagesRoot.id,
    pronunciationLanguage: "es-ES",
    secondaryLanguage: "en-GB",
    baseLanguage: "en-GB",
  });
  decks += 1;
  cards += await addLanguagePairCards(spanish.id, "es-ES", "en-GB", [
    ["Greetings", ["es", "vocab", "greetings"], [
      ["¡hola!", "hello!"],
      ["buenos días", "good morning"],
      ["buenas noches", "good night"],
      ["¿cómo estás?", "how are you?"],
      ["por favor", "please"],
      ["lo siento", "I'm sorry"],
    ]],
    ["Food", ["es", "vocab", "food"], [
      ["manzana", "apple"],
      ["pan", "bread"],
      ["queso", "cheese"],
      ["pescado", "fish"],
      ["pollo", "chicken"],
      ["agua", "water"],
    ]],
  ]);

  const german = await createDeck({
    name: "German",
    description: "de-DE ↔ en-GB. Auto-pronounce always reads the German side.",
    subject: "German",
    colour: "#3E8E63",
    parentId: languagesRoot.id,
    pronunciationLanguage: "de-DE",
    secondaryLanguage: "en-GB",
    baseLanguage: "en-GB",
  });
  decks += 1;
  cards += await addLanguagePairCards(german.id, "de-DE", "en-GB", [
    ["Wortschatz", ["de", "vocab"], [
      ["schön", "beautiful"],
      ["Käse", "cheese"],
      ["Tür", "door"],
      ["Größe", "size"],
      ["heißen", "to be called"],
      ["Übung", "exercise"],
    ]],
  ]);

  // ---- Root: Physics A-level (mixed card types) ----

  const physicsRoot = await createDeck({
    name: `${DEBUG_PREFIX} Physics A-level`,
    description: "Three topic decks with a mix of basic, cloze, MCQ, and typed cards.",
    subject: "Physics",
    colour: "#1E3A5F",
  });
  decks += 1;

  const mechanics = await createDeck({
    name: "Mechanics",
    description: "Newton's laws, motion, momentum.",
    subject: "Physics",
    colour: "#3D7AB8",
    parentId: physicsRoot.id,
  });
  decks += 1;
  cards += await addPhysicsMechanicsCards(mechanics.id);

  const waves = await createDeck({
    name: "Waves",
    description: "Wave properties, sound, light.",
    subject: "Physics",
    colour: "#7A5BA8",
    parentId: physicsRoot.id,
  });
  decks += 1;
  cards += await addPhysicsWavesCards(waves.id);

  const electricity = await createDeck({
    name: "Electricity",
    description: "Circuits, Ohm's law, components.",
    subject: "Physics",
    colour: "#D4912E",
    parentId: physicsRoot.id,
  });
  decks += 1;
  cards += await addPhysicsElectricityCards(electricity.id);

  // ---- Root: Biology GCSE ----

  const biologyRoot = await createDeck({
    name: `${DEBUG_PREFIX} Biology GCSE`,
    description: "Cells and genetics with mixed card types.",
    subject: "Biology",
    colour: "#3E8E63",
  });
  decks += 1;

  const cellsDeck = await createDeck({
    name: "Cells",
    description: "Structure, organelles, transport.",
    subject: "Biology",
    colour: "#3E8E63",
    parentId: biologyRoot.id,
  });
  decks += 1;
  cards += await addBiologyCellsCards(cellsDeck.id);

  const geneticsDeck = await createDeck({
    name: "Genetics",
    description: "DNA, inheritance, mutations.",
    subject: "Biology",
    colour: "#7A5BA8",
    parentId: biologyRoot.id,
  });
  decks += 1;
  cards += await addBiologyGeneticsCards(geneticsDeck.id);

  // ---- Root: Card types showcase ----

  const showcase = await createDeck({
    name: `${DEBUG_PREFIX} Card types showcase`,
    description: "One of each text-card type so you can demo the editor.",
    subject: "Demo",
    colour: "#7A5BA8",
  });
  decks += 1;
  cards += await addShowcaseCards(showcase.id);

  // ---- Review history + sessions ----

  await seedReviewHistory({
    french: french.id,
    spanish: spanish.id,
    german: german.id,
    mechanics: mechanics.id,
    waves: waves.id,
    electricity: electricity.id,
    cells: cellsDeck.id,
    genetics: geneticsDeck.id,
  });

  return { decksCreated: decks, cardsCreated: cards, alreadySeeded: false };
}

// ---- Card-builder helpers ----

type SubDeckSpec = [
  /* name */ string,
  /* tags */ string[],
  /* pairs */ readonly (readonly [string, string])[],
];

// Builds one sub-deck per spec under a language-pair parent. Each pair is
// turned into an auto-reverse Basic card, so card count doubles. Returns
// total cards created (counting the reverse sibling).
async function addLanguagePairCards(
  parentId: string,
  primaryLang: string,
  secondaryLang: string,
  specs: SubDeckSpec[],
): Promise<number> {
  let total = 0;
  for (const [name, tags, pairs] of specs) {
    const sub = await createDeck({
      name,
      subject: name,
      colour: "#3D7AB8",
      parentId,
      pronunciationLanguage: primaryLang,
      secondaryLanguage: secondaryLang,
      baseLanguage: secondaryLang,
    });
    for (const [front, back] of pairs) {
      await createBasicCard({
        deckId: sub.id,
        tags,
        front: { text: front, language: primaryLang },
        back: { text: back, language: secondaryLang },
        autoReverse: true,
      });
      total += 2; // primary + auto-reverse sibling
    }
  }
  return total;
}

async function addPhysicsMechanicsCards(deckId: string): Promise<number> {
  let n = 0;
  for (const [front, back, tags] of [
    [
      "State Newton's first law.",
      "An object at rest stays at rest, and one in motion stays in motion, unless acted on by a net external force.",
      ["physics", "mechanics", "newton", "definitions"],
    ],
    [
      "Define momentum.",
      "Momentum p = m·v — mass times velocity. A vector, units kg·m/s.",
      ["physics", "mechanics", "definitions"],
    ],
    [
      "What is the formula for kinetic energy?",
      "KE = ½ m v². Units: joules.",
      ["physics", "mechanics", "formulas"],
    ],
    [
      "What does Newton's third law say about forces?",
      "Forces come in equal-magnitude, opposite-direction pairs that act on different bodies.",
      ["physics", "mechanics", "newton", "exam"],
    ],
    [
      "Define elastic vs inelastic collision.",
      "Elastic: kinetic energy is conserved. Inelastic: kinetic energy is not conserved (some becomes heat/sound), but momentum still is.",
      ["physics", "mechanics", "tricky"],
    ],
  ] as const) {
    await createBasicCard({
      deckId,
      tags: [...tags],
      front: { text: front },
      back: { text: back },
      autoReverse: false,
    });
    n += 1;
  }
  await createClozeCardSet({
    deckId,
    tags: ["physics", "mechanics", "newton", "formulas"],
    text: "Newton's second law: {{c1::F = m·a}}. The acceleration is in the same direction as the {{c2::net force}}.",
  });
  n += 2;
  return n;
}

async function addPhysicsWavesCards(deckId: string): Promise<number> {
  let n = 0;
  for (const [front, back, tags] of [
    [
      "Define wavelength.",
      "The distance over which a wave's shape repeats — peak to peak, or trough to trough.",
      ["physics", "waves", "definitions"],
    ],
    [
      "Wave equation linking speed, frequency, wavelength?",
      "v = f · λ. Speed equals frequency times wavelength.",
      ["physics", "waves", "formulas"],
    ],
    [
      "Sound: longitudinal or transverse?",
      "Longitudinal — particles oscillate parallel to the direction of travel.",
      ["physics", "waves", "exam"],
    ],
    [
      "What is total internal reflection?",
      "When light hits a boundary from the denser side at an angle greater than the critical angle, it reflects entirely back into the denser medium.",
      ["physics", "waves", "optics", "tricky"],
    ],
  ] as const) {
    await createBasicCard({
      deckId,
      tags: [...tags],
      front: { text: front },
      back: { text: back },
      autoReverse: false,
    });
    n += 1;
  }
  await createMcqCard({
    deckId,
    tags: ["physics", "waves", "multiple-choice", "exam"],
    question: { text: "Which colour of visible light has the highest frequency?" },
    options: [
      { id: newId(), text: "Violet", correct: true },
      { id: newId(), text: "Red", correct: false },
      { id: newId(), text: "Yellow", correct: false },
      { id: newId(), text: "Green", correct: false },
    ],
    shuffleOptions: true,
  });
  n += 1;
  await createMcqCard({
    deckId,
    tags: ["physics", "waves", "multiple-choice"],
    question: { text: "Which property of a wave determines its loudness (for sound)?" },
    options: [
      { id: newId(), text: "Amplitude", correct: true },
      { id: newId(), text: "Frequency", correct: false },
      { id: newId(), text: "Wavelength", correct: false },
      { id: newId(), text: "Speed", correct: false },
    ],
    shuffleOptions: true,
  });
  n += 1;
  return n;
}

async function addPhysicsElectricityCards(deckId: string): Promise<number> {
  let n = 0;
  await createClozeCardSet({
    deckId,
    tags: ["physics", "electricity", "formulas"],
    text: "Ohm's law: {{c1::V = I·R}}. The current through a resistor is {{c2::proportional}} to the voltage across it.",
  });
  n += 2;
  await createClozeCardSet({
    deckId,
    tags: ["physics", "electricity", "formulas"],
    text: "Electrical power dissipated by a resistor: {{c1::P = V·I}} or equivalently {{c2::P = I²·R}}.",
  });
  n += 2;
  await createClozeCardSet({
    deckId,
    tags: ["physics", "electricity", "definitions"],
    text: "Charge Q passes through a wire at current I over time t: {{c1::Q = I·t}}.",
  });
  n += 1;
  await createTypedCard({
    deckId,
    tags: ["physics", "electricity", "calculation"],
    prompt: { text: "Current through a 12 Ω resistor with 24 V across it (in amperes)?" },
    acceptedAnswers: ["2", "2 A", "2A", "two"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  n += 1;
  await createTypedCard({
    deckId,
    tags: ["physics", "electricity", "calculation", "tricky"],
    prompt: { text: "Power dissipated by a 5 Ω resistor carrying 3 A (in watts)?" },
    acceptedAnswers: ["45", "45 W", "45W"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  n += 1;
  return n;
}

async function addBiologyCellsCards(deckId: string): Promise<number> {
  let n = 0;
  for (const [front, back, tags] of [
    [
      "Function of the mitochondrion?",
      "Aerobic respiration — releases energy from glucose to make ATP.",
      ["biology", "gcse", "cells", "organelles"],
    ],
    [
      "Function of the ribosome?",
      "Site of protein synthesis (translation).",
      ["biology", "gcse", "cells", "organelles"],
    ],
    [
      "Difference between animal and plant cells?",
      "Plant cells additionally have a cell wall, chloroplasts, and a permanent vacuole.",
      ["biology", "gcse", "cells", "exam"],
    ],
    [
      "What is diffusion?",
      "The net movement of particles from a region of higher concentration to one of lower concentration.",
      ["biology", "gcse", "cells", "transport"],
    ],
    [
      "Define osmosis.",
      "The diffusion of water molecules across a partially permeable membrane from a dilute to a more concentrated solution.",
      ["biology", "gcse", "cells", "transport", "definitions"],
    ],
  ] as const) {
    await createBasicCard({
      deckId,
      tags: [...tags],
      front: { text: front },
      back: { text: back },
      autoReverse: false,
    });
    n += 1;
  }
  await createMcqCard({
    deckId,
    tags: ["biology", "gcse", "cells", "multiple-choice"],
    question: { text: "Which organelle controls what enters and leaves a cell?" },
    options: [
      { id: newId(), text: "Cell membrane", correct: true },
      { id: newId(), text: "Cytoplasm", correct: false },
      { id: newId(), text: "Nucleus", correct: false },
      { id: newId(), text: "Ribosome", correct: false },
    ],
    shuffleOptions: true,
  });
  n += 1;
  return n;
}

async function addBiologyGeneticsCards(deckId: string): Promise<number> {
  let n = 0;
  await createClozeCardSet({
    deckId,
    tags: ["biology", "gcse", "genetics", "definitions"],
    text: "A {{c1::gene}} is a section of DNA that codes for a particular {{c2::protein}}.",
  });
  n += 2;
  await createClozeCardSet({
    deckId,
    tags: ["biology", "gcse", "genetics", "definitions"],
    text: "Different versions of the same gene are called {{c1::alleles}}.",
  });
  n += 1;
  await createTypedCard({
    deckId,
    tags: ["biology", "gcse", "genetics", "calculation"],
    prompt: { text: "How many pairs of chromosomes in a human body cell?" },
    acceptedAnswers: ["23", "twenty-three", "twenty three"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  n += 1;
  await createTypedCard({
    deckId,
    tags: ["biology", "gcse", "genetics", "exam"],
    prompt: { text: "What sugar is found in DNA?" },
    acceptedAnswers: ["deoxyribose"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  n += 1;
  return n;
}

async function addShowcaseCards(deckId: string): Promise<number> {
  let n = 0;
  await createBasicCard({
    deckId,
    tags: ["demo", "basic"],
    front: { text: "What is the speed of light in a vacuum?" },
    back: { text: "Approximately 3 × 10⁸ m/s." },
    autoReverse: false,
  });
  n += 1;
  const clozeCards = await createClozeCardSet({
    deckId,
    tags: ["demo", "cloze"],
    text: "Newton's first law: an object in motion stays in motion unless acted on by {{c1::a net force}}. Newton's second law gives us {{c2::F = ma}}.",
  });
  n += clozeCards.length;
  await createMcqCard({
    deckId,
    tags: ["demo", "mcq"],
    question: { text: "Which of these is a noble gas?" },
    options: [
      { id: newId(), text: "Argon", correct: true },
      { id: newId(), text: "Chlorine", correct: false },
      { id: newId(), text: "Sodium", correct: false },
      { id: newId(), text: "Oxygen", correct: false },
    ],
    shuffleOptions: true,
  });
  n += 1;
  await createTypedCard({
    deckId,
    tags: ["demo", "typed"],
    prompt: { text: "What is 7 + 5?" },
    acceptedAnswers: ["12", "twelve"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  n += 1;
  return n;
}

// ---- Review history seeding ----

const DAY_MS = 24 * 60 * 60 * 1000;

interface ReviewSeedDeckIds {
  french: string;
  spanish: string;
  german: string;
  mechanics: string;
  waves: string;
  electricity: string;
  cells: string;
  genetics: string;
}

// Daily review counts for the last 14 days (oldest -> today). Designed to
// drive the Stats screen: a clear upward trend the past week, a one-day
// gap rescued by the rest-day rule, and enough variety for the rating
// breakdown to look human.
const DAILY_PATTERN: { count: number; mix: Rating[] }[] = [
  { count: 12, mix: [3, 3, 3, 3, 2, 3, 4, 3, 3, 2, 1, 3] }, // 14 days ago
  { count: 8,  mix: [3, 3, 3, 2, 3, 3, 4, 3] },
  { count: 0,  mix: [] }, // rest day
  { count: 10, mix: [3, 3, 3, 3, 4, 3, 3, 2, 3, 4] },
  { count: 14, mix: [3, 3, 3, 3, 3, 2, 3, 4, 3, 3, 2, 3, 4, 3] },
  { count: 9,  mix: [3, 3, 3, 4, 3, 3, 2, 3, 3] },
  { count: 11, mix: [3, 3, 3, 2, 3, 4, 3, 3, 3, 1, 3] },
  { count: 7,  mix: [3, 3, 4, 3, 3, 3, 2] }, // 7 days ago
  { count: 15, mix: [3, 3, 3, 3, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3] },
  { count: 13, mix: [3, 3, 3, 2, 3, 3, 4, 3, 3, 3, 2, 3, 4] },
  { count: 18, mix: [3, 3, 3, 3, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3, 2, 3, 4] },
  { count: 16, mix: [3, 3, 3, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3, 2, 3] },
  { count: 12, mix: [3, 3, 3, 3, 4, 3, 3, 2, 3, 3, 4, 3] },
  { count: 20, mix: [3, 3, 3, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 2, 3] }, // today
];

async function seedReviewHistory(decks: ReviewSeedDeckIds): Promise<void> {
  // Pick a stable shortlist of cards from each deck to populate review
  // history. We don't need *every* card to be reviewed — just enough to
  // make the deck-stats and global-stats screens come alive.
  const deckCards = await Promise.all(
    Object.values(decks).map((id) => db.cards.where("deckId").equals(id).toArray()),
  );
  const allCards: Card[] = deckCards.flat();
  if (allCards.length === 0) return;

  const todayAfternoon = new Date();
  todayAfternoon.setHours(17, 0, 0, 0);
  const anchor = todayAfternoon.getTime();

  const reviews: ReviewEvent[] = [];
  const sessions: Session[] = [];
  let activeDays = 0;
  let streakDays = 0;

  for (let i = 0; i < DAILY_PATTERN.length; i += 1) {
    const offsetDays = DAILY_PATTERN.length - 1 - i;
    const day = DAILY_PATTERN[i];
    if (day.count === 0) {
      streakDays = 0;
      continue;
    }
    const dayAnchor = anchor - offsetDays * DAY_MS;
    activeDays += 1;
    // Sessions don't perfectly mirror reviews — we just need at least one
    // session per active day for the "sessions on day" drill-down.
    const sessionId = newId();
    const startedAt = dayAnchor - 10 * 60 * 1000; // 10 min ago
    let cardsReviewed = 0;
    let cardsCorrect = 0;
    let totalTime = 0;
    const usedDeckIds = new Set<string>();

    for (let r = 0; r < day.count; r += 1) {
      const card = allCards[(i * 7 + r) % allCards.length];
      const rating = day.mix[r % day.mix.length] ?? 3;
      // Reviews land a few minutes apart so they're recognisably part of
      // the same session.
      const ts = startedAt + r * 30 * 1000;
      const timeTakenMs = 3000 + ((r * 1311) % 5000); // 3-8s pseudo-random
      reviews.push(
        buildReview(card.id, card.fsrs, card.deckId, ts, sessionId, rating, timeTakenMs),
      );
      cardsReviewed += 1;
      if (rating >= 3) cardsCorrect += 1;
      totalTime += timeTakenMs;
      usedDeckIds.add(card.deckId);
    }

    sessions.push({
      id: sessionId,
      startedAt,
      endedAt: startedAt + totalTime,
      deckIds: [...usedDeckIds],
      cardsReviewed,
      cardsCorrect,
      totalTimeMs: totalTime,
      mode: "standard",
    });
    streakDays += 1;
  }

  if (reviews.length === 0) return;
  await db.reviews.bulkAdd(reviews);
  await db.sessions.bulkAdd(sessions);

  // Streak: count consecutive non-rest active days at the tail of the
  // pattern. The DAILY_PATTERN has the rest day early on, so by today
  // we've got a 12-day run.
  const today = new Date(anchor);
  await db.profile.update("self", {
    streakDays,
    longestStreak: Math.max(streakDays, activeDays),
    lastReviewDate: isoLocalDate(today),
  });
}

function buildReview(
  cardId: string,
  fsrs: FsrsState,
  deckId: string,
  timestamp: number,
  sessionId: string,
  rating: Rating,
  timeTakenMs: number,
): ReviewEvent {
  return {
    id: newId(),
    cardId,
    deckId,
    timestamp,
    rating,
    timeTakenMs,
    // The card's current FSRS state is used for both sides of the audit so
    // the seed doesn't have to walk applyRating; the stats displays only
    // read deckId + timestamp + rating.
    previousState: fsrs,
    nextState: fsrs,
    sessionId,
  };
}

function isoLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Wipe absolutely everything: profile, decks, cards, media, reviews, sessions.
// Used by the Debug "Wipe all local data" button after a confirm dialog.
// Reloads the page so the bootstrap rerun creates a fresh profile.
export async function wipeAllData(): Promise<void> {
  await db.delete();
  location.reload();
}
