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
import type { FsrsState, ReviewEvent, Session, Rating } from "./types";

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

// Look up a deck by exact name. Used by ensureDeck() below to make
// the seeder per-deck idempotent: when a new demo deck lands in the
// code, only it gets created on the next boot — existing demo decks
// stay untouched (with their review history and FSRS state intact).
async function findDeckByName(name: string) {
  const all = await db.decks.toArray();
  return all.find((d) => d.name === name) ?? null;
}

// Create the deck only if it doesn't already exist (by exact name).
// When the deck is newly created, runs `populate` to add its cards
// and reports the count back through the return value. When the deck
// already exists, no cards are touched — the deck's contents and any
// review history on them survive across reseeds.
async function ensureDeck<T extends { name: string }>(
  spec: T,
  createFn: (spec: T) => Promise<{ id: string }>,
  populate?: (deckId: string) => Promise<number>,
): Promise<{ deckId: string; created: boolean; cardsCreated: number }> {
  const existing = await findDeckByName(spec.name);
  if (existing) {
    return { deckId: existing.id, created: false, cardsCreated: 0 };
  }
  const deck = await createFn(spec);
  const cardsCreated = populate ? await populate(deck.id) : 0;
  return { deckId: deck.id, created: true, cardsCreated };
}

export async function seedDebugData(): Promise<SeedDebugResult> {
  // For the "is this a first-time seed?" gate on review history, we
  // capture the state BEFORE we start creating anything. Subsequent
  // calls (e.g. on every app boot during prototyping) skip the heavy
  // review-history seed entirely so we don't keep piling fake
  // sessions onto the Stats page.
  const wasFirstTimeSeed = !(await debugDecksExist());

  let cards = 0;
  let decks = 0;

  // Small tally helper. Each `ensureDeck` result feeds in; existing
  // decks contribute 0 and don't disturb the totals.
  const tally = (r: { created: boolean; cardsCreated: number }) => {
    if (r.created) decks += 1;
    cards += r.cardsCreated;
  };

  // ---- Root: Languages (with three child decks: French, Spanish, German) ----
  //
  // The language sub-decks (French, Spanish, German) and their nested
  // sub-decks (Greetings, Numbers, etc.) are only created when the
  // parent root is freshly seeded. Once the Languages root exists,
  // partial top-ups of sub-decks are skipped — keeps the seeder
  // simple and avoids accidentally inserting cards under a deck the
  // user has been editing.
  const languagesRoot = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Languages`,
      description:
        "Three language pairs — French, Spanish, German — each with its own sub-decks.",
      subject: "Languages",
      colour: "#C9A14A",
    },
    (spec) => createDeck(spec),
  );
  tally(languagesRoot);

  if (languagesRoot.created) {
    const french = await createDeck({
      name: "French",
      description: "fr-FR ↔ en-GB. Auto-pronounce always reads the French side.",
      subject: "French",
      colour: "#3D7AB8",
      parentId: languagesRoot.deckId,
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
      ["Numbers 1–10", ["fr", "vocab", "numbers", "A1"], [
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
      ["Common verbs", ["fr", "vocab", "verbs", "irregular"], [
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
      parentId: languagesRoot.deckId,
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
      parentId: languagesRoot.deckId,
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
  }

  // ---- Root: Physics A-level (mixed card types) ----
  const physicsRoot = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Physics A-level`,
      description: "Three topic decks with a mix of basic, cloze, MCQ, and typed cards.",
      subject: "Physics",
      colour: "#1E3A5F",
    },
    (spec) => createDeck(spec),
  );
  tally(physicsRoot);

  if (physicsRoot.created) {
    const mechanics = await createDeck({
      name: "Mechanics",
      description: "Newton's laws, motion, momentum.",
      subject: "Physics",
      colour: "#3D7AB8",
      parentId: physicsRoot.deckId,
    });
    decks += 1;
    cards += await addPhysicsMechanicsCards(mechanics.id);

    const waves = await createDeck({
      name: "Waves",
      description: "Wave properties, sound, light.",
      subject: "Physics",
      colour: "#7A5BA8",
      parentId: physicsRoot.deckId,
    });
    decks += 1;
    cards += await addPhysicsWavesCards(waves.id);

    const electricity = await createDeck({
      name: "Electricity",
      description: "Circuits, Ohm's law, components.",
      subject: "Physics",
      colour: "#D4912E",
      parentId: physicsRoot.deckId,
    });
    decks += 1;
    cards += await addPhysicsElectricityCards(electricity.id);
  }

  // ---- Root: Biology GCSE ----
  const biologyRoot = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Biology GCSE`,
      description: "Cells and genetics with mixed card types.",
      subject: "Biology",
      colour: "#3E8E63",
    },
    (spec) => createDeck(spec),
  );
  tally(biologyRoot);

  if (biologyRoot.created) {
    const cellsDeck = await createDeck({
      name: "Cells",
      description: "Structure, organelles, transport.",
      subject: "Biology",
      colour: "#3E8E63",
      parentId: biologyRoot.deckId,
    });
    decks += 1;
    cards += await addBiologyCellsCards(cellsDeck.id);

    const geneticsDeck = await createDeck({
      name: "Genetics",
      description: "DNA, inheritance, mutations.",
      subject: "Biology",
      colour: "#7A5BA8",
      parentId: biologyRoot.deckId,
    });
    decks += 1;
    cards += await addBiologyGeneticsCards(geneticsDeck.id);
  }

  // ---- Root: Card types showcase ----
  const showcase = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Card types showcase`,
      description: "One of each text-card type so you can demo the editor.",
      subject: "Demo",
      colour: "#7A5BA8",
    },
    (spec) => createDeck(spec),
    (deckId) => addShowcaseCards(deckId),
  );
  tally(showcase);

  // ---- Roots: Rapid-fire decks (purpose-built for Flashcard Survivors) ----
  //
  // The "real" subject decks above mix card types (cloze, MCQ, typed)
  // that Survivors silently skips, and the language decks have
  // multi-word backs ("to be", "thank you very much") that are awkward
  // to type during a run. Each rapid-fire deck below is exclusively
  // basic-front/back with single-word answers — drop a stakeholder
  // straight into Survivors on any of them and the demo plays cleanly.
  // One per subject (Physics / Biology / Languages / Philosophy) so the
  // mode-select screen always has a deck pre-tuned to the player's
  // interests. Each goes through ensureDeck so adding a new rapid-fire
  // subject later lands automatically on next boot.
  const physicsRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Physics rapid-fire`,
      description:
        "Short physics-fact prompts with one-word answers. Built for Flashcard Survivors but works as a regular deck too.",
      subject: "Physics",
      colour: "#3D7AB8",
    },
    (spec) => createDeck(spec),
    (deckId) => addPhysicsRapidFireCards(deckId),
  );
  tally(physicsRapidFire);

  const biologyRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Biology rapid-fire`,
      description:
        "Short biology-fact prompts with one-word answers — organelles, processes, scientists.",
      subject: "Biology",
      colour: "#3E8E63",
    },
    (spec) => createDeck(spec),
    (deckId) => addBiologyRapidFireCards(deckId),
  );
  tally(biologyRapidFire);

  const languagesRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Languages rapid-fire`,
      description:
        "Foreign word → single English answer, mixing French, Spanish, and German. Accent-tolerant.",
      subject: "Languages",
      colour: "#C9A14A",
    },
    (spec) => createDeck(spec),
    (deckId) => addLanguagesRapidFireCards(deckId),
  );
  tally(languagesRapidFire);

  const philosophyRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Philosophy rapid-fire`,
      description:
        "Philosophers, schools, and key terms with one-word answers.",
      subject: "Philosophy",
      colour: "#7A5BA8",
    },
    (spec) => createDeck(spec),
    (deckId) => addPhilosophyRapidFireCards(deckId),
  );
  tally(philosophyRapidFire);

  const latinRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Latin rapid-fire`,
      description:
        "Latin → English single-word translations. Common vocab.",
      subject: "Latin",
      colour: "#8B5A2B",
    },
    (spec) => createDeck(spec),
    (deckId) => addLatinRapidFireCards(deckId),
  );
  tally(latinRapidFire);

  const classCivRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} Classical Civilisation rapid-fire`,
      description:
        "Greek and Roman myth, history, and culture — one-word answers.",
      subject: "Classical Civilisation",
      colour: "#A8753B",
    },
    (spec) => createDeck(spec),
    (deckId) => addClassCivRapidFireCards(deckId),
  );
  tally(classCivRapidFire);

  const mdrRapidFire = await ensureDeck(
    {
      name: `${DEBUG_PREFIX} MDR / MDSAP rapid-fire`,
      description:
        "EU MDR (2017/745) and MDSAP regulatory facts — class codes, agencies, standards.",
      subject: "Medical Device Regulation",
      colour: "#1F6B7A",
    },
    (spec) => createDeck(spec),
    (deckId) => addMdrRapidFireCards(deckId),
  );
  tally(mdrRapidFire);

  // ---- Review history + sessions ----
  //
  // Only fire on a true first-time seed. On subsequent boots where
  // some demo decks already exist (or all of them, with one or two
  // new rapid-fire decks landing), the Stats page shouldn't keep
  // accumulating fake sessions. The showcase and rapid-fire decks
  // are excluded from history seeding because: showcase = pristine
  // editor demo, rapid-fire = every card should start due for a
  // Survivors run.
  if (wasFirstTimeSeed) {
    await seedReviewHistory({
      excludeDeckIds: [
        showcase.deckId,
        physicsRapidFire.deckId,
        biologyRapidFire.deckId,
        languagesRapidFire.deckId,
        philosophyRapidFire.deckId,
        latinRapidFire.deckId,
        classCivRapidFire.deckId,
        mdrRapidFire.deckId,
      ],
    });
  }

  return {
    decksCreated: decks,
    cardsCreated: cards,
    // The Settings "Generate sample decks" button uses this flag to
    // tell the user "already seeded" vs "created N decks". We treat
    // alreadySeeded as "this call added nothing new" — which matches
    // the user-visible meaning even though the implementation now
    // tops up incrementally.
    alreadySeeded: decks === 0,
  };
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
      ["physics", "mechanics", "definitions", "conservation-laws"],
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
      ["physics", "waves", "optics", "definitions"],
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
    tags: ["physics", "electricity", "calculation", "power"],
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
    tags: ["biology", "gcse", "genetics", "chromosomes"],
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

// Survivors-friendly deck. Every card is basic, every answer is a single
// word, every front is short enough to read on a moving shape. Cards stay
// out of the review-history seed (see seedDebugData) so they're all due
// from the moment the deck lands in the demo.
async function addPhysicsRapidFireCards(deckId: string): Promise<number> {
  const cards: { front: string; back: string; tags: string[] }[] = [
    // Atomic structure ------------------------------------------------
    {
      front: "What negative particle orbits the nucleus of an atom?",
      back: "Electron",
      tags: ["physics", "particles", "atomic-structure"],
    },
    {
      front: "What positively charged particle is found in the nucleus?",
      back: "Proton",
      tags: ["physics", "particles", "atomic-structure"],
    },
    {
      front: "What neutral particle is found in the nucleus?",
      back: "Neutron",
      tags: ["physics", "particles", "atomic-structure"],
    },
    {
      front: "What is the central part of an atom called?",
      back: "Nucleus",
      tags: ["physics", "atomic-structure"],
    },
    {
      front: "What collective name is given to protons and neutrons?",
      back: "Nucleons",
      tags: ["physics", "particles", "atomic-structure"],
    },
    // SI units ---------------------------------------------------------
    {
      front: "What is the SI unit of force?",
      back: "Newton",
      tags: ["physics", "units"],
    },
    {
      front: "What is the SI unit of energy?",
      back: "Joule",
      tags: ["physics", "units"],
    },
    {
      front: "What is the SI unit of power?",
      back: "Watt",
      tags: ["physics", "units"],
    },
    {
      front: "What is the SI unit of frequency?",
      back: "Hertz",
      tags: ["physics", "units", "waves"],
    },
    {
      front: "What is the SI unit of electric current?",
      back: "Ampere",
      tags: ["physics", "units", "electricity"],
    },
    {
      front: "What is the SI unit of voltage?",
      back: "Volt",
      tags: ["physics", "units", "electricity"],
    },
    {
      front: "What is the SI unit of electrical resistance?",
      back: "Ohm",
      tags: ["physics", "units", "electricity"],
    },
    {
      front: "What is the SI unit of pressure?",
      back: "Pascal",
      tags: ["physics", "units"],
    },
    {
      front: "What is the SI unit of charge?",
      back: "Coulomb",
      tags: ["physics", "units", "electricity"],
    },
    {
      front: "What is the SI unit of temperature?",
      back: "Kelvin",
      tags: ["physics", "units"],
    },
    // Mechanics --------------------------------------------------------
    {
      front: "What name describes the pull between two masses?",
      back: "Gravity",
      tags: ["physics", "mechanics", "forces"],
    },
    {
      front: "What name describes the resistance opposing motion?",
      back: "Friction",
      tags: ["physics", "mechanics", "forces"],
    },
    {
      front: "What quantity equals mass times velocity?",
      back: "Momentum",
      tags: ["physics", "mechanics"],
    },
    {
      front: "What is the rate of change of velocity called?",
      back: "Acceleration",
      tags: ["physics", "mechanics"],
    },
    {
      front: "What is force per unit area called?",
      back: "Pressure",
      tags: ["physics", "mechanics"],
    },
    // Waves ------------------------------------------------------------
    {
      front: "What is the distance between two wave peaks called?",
      back: "Wavelength",
      tags: ["physics", "waves"],
    },
    {
      front: "What is the maximum displacement of a wave called?",
      back: "Amplitude",
      tags: ["physics", "waves"],
    },
    {
      front: "What process bends light entering a denser medium?",
      back: "Refraction",
      tags: ["physics", "waves", "optics"],
    },
    {
      front: "What process bounces light off a mirror?",
      back: "Reflection",
      tags: ["physics", "waves", "optics"],
    },
    {
      front: "What process spreads waves around an obstacle's edge?",
      back: "Diffraction",
      tags: ["physics", "waves"],
    },
    // Scientists -------------------------------------------------------
    {
      front: "Who proposed the three laws of motion?",
      back: "Newton",
      tags: ["physics", "scientists"],
    },
    {
      front: "Who developed the theory of general relativity?",
      back: "Einstein",
      tags: ["physics", "scientists"],
    },
    {
      front: "Who discovered the electron?",
      back: "Thomson",
      tags: ["physics", "scientists", "atomic-structure"],
    },
    {
      front: "Whose gold-foil experiment revealed the atomic nucleus?",
      back: "Rutherford",
      tags: ["physics", "scientists", "atomic-structure"],
    },
    {
      front: "Who proposed the planetary model of the atom?",
      back: "Bohr",
      tags: ["physics", "scientists", "atomic-structure"],
    },
  ];

  let n = 0;
  for (const c of cards) {
    await createBasicCard({
      deckId,
      tags: c.tags,
      front: { text: c.front },
      back: { text: c.back },
      // Reverse cards would ask "Electron" -> "What negative particle…",
      // which works grammatically but loses the question-style framing
      // that makes this deck snappy. One-direction only.
      autoReverse: false,
    });
    n += 1;
  }
  return n;
}

// Helper shared by the rapid-fire deck seeders below. Same shape as
// Physics: question front → one-word back, no auto-reverse so the
// "Electron" → "What negative particle…" reverse doesn't sneak in.
async function addRapidFireBasicCards(
  deckId: string,
  cards: { front: string; back: string; tags: string[] }[],
): Promise<number> {
  let n = 0;
  for (const c of cards) {
    await createBasicCard({
      deckId,
      tags: c.tags,
      front: { text: c.front },
      back: { text: c.back },
      autoReverse: false,
    });
    n += 1;
  }
  return n;
}

async function addBiologyRapidFireCards(deckId: string): Promise<number> {
  return addRapidFireBasicCards(deckId, [
    // Organelles ---------------------------------------------------
    {
      front: "Which organelle is the powerhouse of the cell?",
      back: "Mitochondria",
      tags: ["biology", "cells", "organelles"],
    },
    {
      front: "Which organelle is the site of protein synthesis?",
      back: "Ribosome",
      tags: ["biology", "cells", "organelles"],
    },
    {
      front: "Which organelle stores genetic information?",
      back: "Nucleus",
      tags: ["biology", "cells", "organelles"],
    },
    {
      front: "What organelle in plants performs photosynthesis?",
      back: "Chloroplast",
      tags: ["biology", "cells", "plants"],
    },
    {
      front: "What is the jelly-like fluid that fills a cell?",
      back: "Cytoplasm",
      tags: ["biology", "cells"],
    },
    // Processes ----------------------------------------------------
    {
      front: "Name the process plants use to make glucose from sunlight.",
      back: "Photosynthesis",
      tags: ["biology", "plants", "processes"],
    },
    {
      front: "Name the cell-division process that produces identical daughter cells.",
      back: "Mitosis",
      tags: ["biology", "cells", "division"],
    },
    {
      front: "Name the cell-division process that produces gametes.",
      back: "Meiosis",
      tags: ["biology", "genetics", "division"],
    },
    {
      front: "Name the process by which the body breaks glucose down to release energy.",
      back: "Respiration",
      tags: ["biology", "processes"],
    },
    {
      front: "Net movement of particles from high to low concentration?",
      back: "Diffusion",
      tags: ["biology", "transport"],
    },
    {
      front: "Movement of water across a partially permeable membrane?",
      back: "Osmosis",
      tags: ["biology", "transport"],
    },
    // Macromolecules + chemistry -----------------------------------
    {
      front: "What molecule carries genetic information in cells?",
      back: "DNA",
      tags: ["biology", "genetics"],
    },
    {
      front: "What pigment makes plant leaves green?",
      back: "Chlorophyll",
      tags: ["biology", "plants"],
    },
    {
      front: "What is the energy currency of the cell?",
      back: "ATP",
      tags: ["biology", "biochemistry"],
    },
    {
      front: "Building blocks of proteins?",
      back: "Amino acids",
      tags: ["biology", "biochemistry"],
    },
    // Anatomy + physiology -----------------------------------------
    {
      front: "Which organ pumps blood around the body?",
      back: "Heart",
      tags: ["biology", "anatomy"],
    },
    {
      front: "Which organ filters waste from the blood to form urine?",
      back: "Kidney",
      tags: ["biology", "anatomy"],
    },
    {
      front: "Which organ produces bile?",
      back: "Liver",
      tags: ["biology", "anatomy"],
    },
    {
      front: "What gas do humans breathe out?",
      back: "Carbon dioxide",
      tags: ["biology", "physiology"],
    },
    {
      front: "What red protein in blood carries oxygen?",
      back: "Haemoglobin",
      tags: ["biology", "physiology"],
    },
    // Ecology + taxonomy -------------------------------------------
    {
      front: "What is a self-supporting organism that makes its own food called?",
      back: "Autotroph",
      tags: ["biology", "ecology"],
    },
    {
      front: "What is an organism that eats other organisms called?",
      back: "Heterotroph",
      tags: ["biology", "ecology"],
    },
    {
      front: "What term describes all the populations in an area?",
      back: "Community",
      tags: ["biology", "ecology"],
    },
    // Scientists ---------------------------------------------------
    {
      front: "Who proposed the theory of evolution by natural selection?",
      back: "Darwin",
      tags: ["biology", "scientists"],
    },
    {
      front: "Whose pea-plant experiments founded genetics?",
      back: "Mendel",
      tags: ["biology", "scientists", "genetics"],
    },
    {
      front: "Who, with Crick, described the DNA double helix?",
      back: "Watson",
      tags: ["biology", "scientists", "genetics"],
    },
  ]);
}

async function addLanguagesRapidFireCards(deckId: string): Promise<number> {
  // Foreign word → single English answer. Mixes French, Spanish, and
  // German so the deck doubles as a quick "which language was that?"
  // memory check. Accents on the front are read fine by the typing
  // engine — students can type "etre" for "être" thanks to
  // normaliseAnswer's accent folding.
  return addRapidFireBasicCards(deckId, [
    // French -------------------------------------------------------
    { front: "What does 'bonjour' mean?", back: "Hello", tags: ["french", "vocab"] },
    { front: "What does 'merci' mean?", back: "Thanks", tags: ["french", "vocab"] },
    { front: "What does 'eau' mean?", back: "Water", tags: ["french", "vocab"] },
    { front: "What does 'rouge' mean?", back: "Red", tags: ["french", "vocab", "colours"] },
    { front: "What does 'chat' mean?", back: "Cat", tags: ["french", "vocab", "animals"] },
    { front: "What does 'chien' mean?", back: "Dog", tags: ["french", "vocab", "animals"] },
    { front: "What does 'livre' mean?", back: "Book", tags: ["french", "vocab"] },
    { front: "What does 'pain' mean (French)?", back: "Bread", tags: ["french", "vocab", "food"] },
    { front: "What does 'grand' mean?", back: "Big", tags: ["french", "vocab"] },
    { front: "What does 'petit' mean?", back: "Small", tags: ["french", "vocab"] },
    // Spanish ------------------------------------------------------
    { front: "What does 'hola' mean?", back: "Hello", tags: ["spanish", "vocab"] },
    { front: "What does 'gracias' mean?", back: "Thanks", tags: ["spanish", "vocab"] },
    { front: "What does 'agua' mean?", back: "Water", tags: ["spanish", "vocab"] },
    { front: "What does 'manzana' mean?", back: "Apple", tags: ["spanish", "vocab", "food"] },
    { front: "What does 'perro' mean?", back: "Dog", tags: ["spanish", "vocab", "animals"] },
    { front: "What does 'gato' mean?", back: "Cat", tags: ["spanish", "vocab", "animals"] },
    { front: "What does 'libro' mean?", back: "Book", tags: ["spanish", "vocab"] },
    { front: "What does 'sol' mean?", back: "Sun", tags: ["spanish", "vocab"] },
    { front: "What does 'casa' mean?", back: "House", tags: ["spanish", "vocab"] },
    { front: "What does 'rojo' mean?", back: "Red", tags: ["spanish", "vocab", "colours"] },
    // German -------------------------------------------------------
    { front: "What does 'Hallo' mean?", back: "Hello", tags: ["german", "vocab"] },
    { front: "What does 'Danke' mean?", back: "Thanks", tags: ["german", "vocab"] },
    { front: "What does 'Wasser' mean?", back: "Water", tags: ["german", "vocab"] },
    { front: "What does 'Brot' mean?", back: "Bread", tags: ["german", "vocab", "food"] },
    { front: "What does 'Hund' mean?", back: "Dog", tags: ["german", "vocab", "animals"] },
    { front: "What does 'Katze' mean?", back: "Cat", tags: ["german", "vocab", "animals"] },
    { front: "What does 'Buch' mean?", back: "Book", tags: ["german", "vocab"] },
    { front: "What does 'Haus' mean?", back: "House", tags: ["german", "vocab"] },
    { front: "What does 'Käse' mean?", back: "Cheese", tags: ["german", "vocab", "food"] },
    { front: "What does 'grün' mean?", back: "Green", tags: ["german", "vocab", "colours"] },
  ]);
}

async function addPhilosophyRapidFireCards(deckId: string): Promise<number> {
  return addRapidFireBasicCards(deckId, [
    // Philosophers (by name) ---------------------------------------
    {
      front: "Who wrote 'The Republic'?",
      back: "Plato",
      tags: ["philosophy", "ancient", "philosophers"],
    },
    {
      front: "Who was famously taught by Socrates?",
      back: "Plato",
      tags: ["philosophy", "ancient", "philosophers"],
    },
    {
      front: "Who tutored Alexander the Great?",
      back: "Aristotle",
      tags: ["philosophy", "ancient", "philosophers"],
    },
    {
      front: "Which philosopher famously said 'I think, therefore I am'?",
      back: "Descartes",
      tags: ["philosophy", "modern", "philosophers"],
    },
    {
      front: "Who proposed the categorical imperative?",
      back: "Kant",
      tags: ["philosophy", "ethics", "philosophers"],
    },
    {
      front: "Who wrote 'Thus Spoke Zarathustra' and declared 'God is dead'?",
      back: "Nietzsche",
      tags: ["philosophy", "modern", "philosophers"],
    },
    {
      front: "Whose social-contract work was 'Leviathan' (1651)?",
      back: "Hobbes",
      tags: ["philosophy", "politics", "philosophers"],
    },
    {
      front: "Who wrote 'A Treatise of Human Nature' and championed empiricism?",
      back: "Hume",
      tags: ["philosophy", "epistemology", "philosophers"],
    },
    {
      front: "Who wrote 'Being and Nothingness' and led French existentialism?",
      back: "Sartre",
      tags: ["philosophy", "existentialism", "philosophers"],
    },
    {
      front: "Who wrote 'The Communist Manifesto'?",
      back: "Marx",
      tags: ["philosophy", "politics", "philosophers"],
    },
    // Branches of philosophy ---------------------------------------
    {
      front: "What is the study of being and existence called?",
      back: "Ontology",
      tags: ["philosophy", "metaphysics", "terms"],
    },
    {
      front: "What is the study of knowledge called?",
      back: "Epistemology",
      tags: ["philosophy", "terms"],
    },
    {
      front: "What is the study of right and wrong action called?",
      back: "Ethics",
      tags: ["philosophy", "terms"],
    },
    {
      front: "What is the study of beauty and art called?",
      back: "Aesthetics",
      tags: ["philosophy", "terms"],
    },
    {
      front: "What is the study of reasoning and valid inference called?",
      back: "Logic",
      tags: ["philosophy", "terms"],
    },
    // Schools and -isms --------------------------------------------
    {
      front: "What is the view that the greatest good is happiness for the greatest number?",
      back: "Utilitarianism",
      tags: ["philosophy", "ethics", "schools"],
    },
    {
      front: "What is the view that life is fundamentally without inherent meaning?",
      back: "Nihilism",
      tags: ["philosophy", "schools"],
    },
    {
      front: "Which school holds that virtue lies in living according to reason and accepting fate?",
      back: "Stoicism",
      tags: ["philosophy", "ancient", "schools"],
    },
    {
      front: "Which school holds that pleasure (well-being) is the highest good?",
      back: "Hedonism",
      tags: ["philosophy", "ethics", "schools"],
    },
    {
      front: "Which view holds that knowledge comes primarily from sensory experience?",
      back: "Empiricism",
      tags: ["philosophy", "epistemology", "schools"],
    },
    {
      front: "Which view holds that knowledge comes primarily from reason?",
      back: "Rationalism",
      tags: ["philosophy", "epistemology", "schools"],
    },
    {
      front: "Which 20th-century school says existence precedes essence?",
      back: "Existentialism",
      tags: ["philosophy", "schools"],
    },
    {
      front: "Which school evaluates beliefs by their practical consequences?",
      back: "Pragmatism",
      tags: ["philosophy", "schools"],
    },
    // Key terms ----------------------------------------------------
    {
      front: "What is the philosophical position that only one's own mind is sure to exist?",
      back: "Solipsism",
      tags: ["philosophy", "epistemology", "terms"],
    },
    {
      front: "What is the term for an argument whose conclusion is supported by its premises?",
      back: "Valid",
      tags: ["philosophy", "logic", "terms"],
    },
    {
      front: "What is the dialectic process of thesis, antithesis, and ___?",
      back: "Synthesis",
      tags: ["philosophy", "terms"],
    },
    {
      front: "What term names the philosophical method of questioning to draw out ideas?",
      back: "Socratic",
      tags: ["philosophy", "ancient", "terms"],
    },
  ]);
}

async function addLatinRapidFireCards(deckId: string): Promise<number> {
  // Latin → English single-word translations. Targeted at common
  // GCSE / A-level vocab so the deck is broadly recognisable.
  return addRapidFireBasicCards(deckId, [
    // Elements / nature ------------------------------------------
    { front: "What does 'aqua' mean?", back: "Water", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'terra' mean?", back: "Earth", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'ignis' mean?", back: "Fire", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'aer' mean?", back: "Air", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'sol' mean?", back: "Sun", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'luna' mean?", back: "Moon", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'stella' mean?", back: "Star", tags: ["latin", "vocab", "nature"] },
    { front: "What does 'silva' mean?", back: "Forest", tags: ["latin", "vocab", "nature"] },
    // People / roles ---------------------------------------------
    { front: "What does 'rex' mean?", back: "King", tags: ["latin", "vocab", "people"] },
    { front: "What does 'regina' mean?", back: "Queen", tags: ["latin", "vocab", "people"] },
    { front: "What does 'puer' mean?", back: "Boy", tags: ["latin", "vocab", "people"] },
    { front: "What does 'puella' mean?", back: "Girl", tags: ["latin", "vocab", "people"] },
    { front: "What does 'servus' mean?", back: "Slave", tags: ["latin", "vocab", "people"] },
    { front: "What does 'amicus' mean?", back: "Friend", tags: ["latin", "vocab", "people"] },
    { front: "What does 'miles' mean?", back: "Soldier", tags: ["latin", "vocab", "people"] },
    { front: "What does 'dominus' mean?", back: "Master", tags: ["latin", "vocab", "people"] },
    // Concepts ---------------------------------------------------
    { front: "What does 'amor' mean?", back: "Love", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'pax' mean?", back: "Peace", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'bellum' mean?", back: "War", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'vita' mean?", back: "Life", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'mors' mean?", back: "Death", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'tempus' mean?", back: "Time", tags: ["latin", "vocab", "concepts"] },
    { front: "What does 'verbum' mean?", back: "Word", tags: ["latin", "vocab", "concepts"] },
    // Adjectives -------------------------------------------------
    { front: "What does 'magnus' mean?", back: "Great", tags: ["latin", "vocab", "adjectives"] },
    { front: "What does 'parvus' mean?", back: "Small", tags: ["latin", "vocab", "adjectives"] },
    { front: "What does 'bonus' mean?", back: "Good", tags: ["latin", "vocab", "adjectives"] },
    { front: "What does 'malus' mean?", back: "Bad", tags: ["latin", "vocab", "adjectives"] },
    { front: "What does 'altus' mean?", back: "High", tags: ["latin", "vocab", "adjectives"] },
    // Verbs (1st-person singular) ---------------------------------
    { front: "What does 'amo' mean?", back: "I love", tags: ["latin", "vocab", "verbs"] },
    { front: "What does 'video' mean?", back: "I see", tags: ["latin", "vocab", "verbs"] },
    { front: "What does 'audio' mean?", back: "I hear", tags: ["latin", "vocab", "verbs"] },
    { front: "What does 'venio' mean?", back: "I come", tags: ["latin", "vocab", "verbs"] },
    { front: "What does 'porto' mean?", back: "I carry", tags: ["latin", "vocab", "verbs"] },
  ]);
}

async function addClassCivRapidFireCards(deckId: string): Promise<number> {
  // Classical Civilisation — Greek and Roman myth, literature,
  // history, and physical culture. One-word answers throughout.
  return addRapidFireBasicCards(deckId, [
    // Greek pantheon ---------------------------------------------
    {
      front: "Who is the Greek god of the sea?",
      back: "Poseidon",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "Who is the Greek god of the underworld?",
      back: "Hades",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "Who is the Greek god of war?",
      back: "Ares",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "Who is the Greek goddess of wisdom?",
      back: "Athena",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "Who is the Greek goddess of love?",
      back: "Aphrodite",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "Who is the messenger god of Olympus?",
      back: "Hermes",
      tags: ["classics", "greek", "myth", "gods"],
    },
    {
      front: "What mountain do the Greek gods call home?",
      back: "Olympus",
      tags: ["classics", "greek", "myth", "places"],
    },
    // Roman names for Greek gods ---------------------------------
    {
      front: "Roman name for Zeus?",
      back: "Jupiter",
      tags: ["classics", "roman", "myth", "gods"],
    },
    {
      front: "Roman name for Hera?",
      back: "Juno",
      tags: ["classics", "roman", "myth", "gods"],
    },
    {
      front: "Roman name for Aphrodite?",
      back: "Venus",
      tags: ["classics", "roman", "myth", "gods"],
    },
    {
      front: "Roman name for Ares?",
      back: "Mars",
      tags: ["classics", "roman", "myth", "gods"],
    },
    {
      front: "Roman name for Hermes?",
      back: "Mercury",
      tags: ["classics", "roman", "myth", "gods"],
    },
    {
      front: "Roman name for Dionysus?",
      back: "Bacchus",
      tags: ["classics", "roman", "myth", "gods"],
    },
    // Heroes + monsters ------------------------------------------
    {
      front: "Who killed the Minotaur?",
      back: "Theseus",
      tags: ["classics", "greek", "myth", "heroes"],
    },
    {
      front: "Who slew the Nemean lion as his first labour?",
      back: "Heracles",
      tags: ["classics", "greek", "myth", "heroes"],
    },
    {
      front: "Who led the Argonauts in search of the Golden Fleece?",
      back: "Jason",
      tags: ["classics", "greek", "myth", "heroes"],
    },
    {
      front: "Trojan-War hero best known for his rage?",
      back: "Achilles",
      tags: ["classics", "greek", "myth", "heroes"],
    },
    {
      front: "Hero whose ten-year homecoming gives Homer's epic its name?",
      back: "Odysseus",
      tags: ["classics", "greek", "myth", "heroes"],
    },
    {
      front: "Gorgon whose gaze turns onlookers to stone?",
      back: "Medusa",
      tags: ["classics", "greek", "myth", "monsters"],
    },
    // Literature -------------------------------------------------
    {
      front: "Greek poet credited with the Iliad and Odyssey?",
      back: "Homer",
      tags: ["classics", "greek", "literature"],
    },
    {
      front: "Roman poet of the Aeneid?",
      back: "Virgil",
      tags: ["classics", "roman", "literature"],
    },
    {
      front: "Roman lyric poet known for the Odes?",
      back: "Horace",
      tags: ["classics", "roman", "literature"],
    },
    // History ----------------------------------------------------
    {
      front: "Greek city-state defined by its army?",
      back: "Sparta",
      tags: ["classics", "greek", "history"],
    },
    {
      front: "Greek city-state credited with inventing democracy?",
      back: "Athens",
      tags: ["classics", "greek", "history"],
    },
    {
      front: "Pass where King Leonidas's force held off the Persians?",
      back: "Thermopylae",
      tags: ["classics", "greek", "history", "battles"],
    },
    {
      front: "Legendary founder of Rome?",
      back: "Romulus",
      tags: ["classics", "roman", "history"],
    },
    {
      front: "First Roman emperor?",
      back: "Augustus",
      tags: ["classics", "roman", "history"],
    },
    {
      front: "Roman dictator assassinated on the Ides of March?",
      back: "Caesar",
      tags: ["classics", "roman", "history"],
    },
    {
      front: "Carthaginian general who crossed the Alps with elephants?",
      back: "Hannibal",
      tags: ["classics", "roman", "history", "battles"],
    },
    {
      front: "River Caesar crossed to march on Rome?",
      back: "Rubicon",
      tags: ["classics", "roman", "history"],
    },
    // Places / monuments -----------------------------------------
    {
      front: "Athenian temple to Athena on the Acropolis?",
      back: "Parthenon",
      tags: ["classics", "greek", "places"],
    },
    {
      front: "Roman amphitheatre famous for gladiator games?",
      back: "Colosseum",
      tags: ["classics", "roman", "places"],
    },
  ]);
}

async function addMdrRapidFireCards(deckId: string): Promise<number> {
  // EU MDR (2017/745) + MDSAP. Punchy, one-or-two-word answers
  // suited for Survivors typing. Covers classification, key
  // standards, MDSAP member agencies, and a few common acronyms.
  return addRapidFireBasicCards(deckId, [
    // EU MDR basics ----------------------------------------------
    {
      front: "Which 2017 EU regulation replaced the MDD for medical devices?",
      back: "MDR",
      tags: ["mdr", "regulation", "eu"],
    },
    {
      front: "EU regulation that replaced the IVDD?",
      back: "IVDR",
      tags: ["mdr", "regulation", "eu", "ivdr"],
    },
    {
      front: "Year the EU MDR (2017/745) was published?",
      back: "2017",
      tags: ["mdr", "regulation", "eu"],
    },
    {
      front: "Year EU MDR full application took effect?",
      back: "2021",
      tags: ["mdr", "regulation", "eu"],
    },
    {
      front: "Which conformity marking signals MDR compliance for the EU market?",
      back: "CE",
      tags: ["mdr", "regulation", "eu", "marking"],
    },
    // Classification ---------------------------------------------
    {
      front: "Highest-risk medical device class under EU MDR?",
      back: "III",
      tags: ["mdr", "classification", "risk"],
    },
    {
      front: "Lowest-risk medical device class under EU MDR?",
      back: "I",
      tags: ["mdr", "classification", "risk"],
    },
    {
      front: "Medium-low-risk class between I and IIb under EU MDR?",
      back: "IIa",
      tags: ["mdr", "classification", "risk"],
    },
    {
      front: "Medium-high-risk class below class III under EU MDR?",
      back: "IIb",
      tags: ["mdr", "classification", "risk"],
    },
    // Key actors / roles -----------------------------------------
    {
      front: "Independent organisation that conducts MDR conformity assessment?",
      back: "Notified body",
      tags: ["mdr", "actors", "eu"],
    },
    {
      front: "Acronym for the MDR-mandated regulatory compliance lead inside a manufacturer?",
      back: "PRRC",
      tags: ["mdr", "actors", "eu"],
    },
    {
      front: "Acronym for a non-EU manufacturer's EU-based legal representative?",
      back: "Authorised representative",
      tags: ["mdr", "actors", "eu"],
    },
    {
      front: "EU-wide medical device database mandated by MDR?",
      back: "Eudamed",
      tags: ["mdr", "databases", "eu"],
    },
    {
      front: "MDR-mandated unique identifier each device must carry?",
      back: "UDI",
      tags: ["mdr", "traceability", "eu"],
    },
    // Post-market + safety ---------------------------------------
    {
      front: "Acronym for ongoing data collection on a device after market release?",
      back: "PMS",
      tags: ["mdr", "post-market", "eu"],
    },
    {
      front: "Acronym for the periodic safety update report under MDR?",
      back: "PSUR",
      tags: ["mdr", "post-market", "eu"],
    },
    {
      front: "EU-MDR term for the system reporting adverse incidents?",
      back: "Vigilance",
      tags: ["mdr", "post-market", "safety"],
    },
    {
      front: "Acronym for documented investigation + fix of a quality issue?",
      back: "CAPA",
      tags: ["mdr", "quality", "qms"],
    },
    // Standards --------------------------------------------------
    {
      front: "ISO standard for medical device quality management systems?",
      back: "13485",
      tags: ["mdr", "standards", "iso"],
    },
    {
      front: "ISO standard for medical device risk management?",
      back: "14971",
      tags: ["mdr", "standards", "iso"],
    },
    {
      front: "IEC standard for medical device software lifecycle?",
      back: "62304",
      tags: ["mdr", "standards", "iec", "software"],
    },
    {
      front: "IEC standard for medical device usability engineering?",
      back: "62366",
      tags: ["mdr", "standards", "iec", "usability"],
    },
    // MDSAP ------------------------------------------------------
    {
      front: "Single audit program covering FDA, Health Canada, ANVISA, TGA, and PMDA?",
      back: "MDSAP",
      tags: ["mdsap", "audit", "international"],
    },
    {
      front: "US agency that participates in MDSAP?",
      back: "FDA",
      tags: ["mdsap", "audit", "usa"],
    },
    {
      front: "Australian agency that participates in MDSAP?",
      back: "TGA",
      tags: ["mdsap", "audit", "australia"],
    },
    {
      front: "Brazilian agency that participates in MDSAP?",
      back: "ANVISA",
      tags: ["mdsap", "audit", "brazil"],
    },
    {
      front: "Japanese agency that participates in MDSAP?",
      back: "PMDA",
      tags: ["mdsap", "audit", "japan"],
    },
    {
      front: "Core ISO standard MDSAP audits are conducted against?",
      back: "13485",
      tags: ["mdsap", "audit", "iso"],
    },
    {
      front: "MDSAP audit cycle length in years?",
      back: "Three",
      tags: ["mdsap", "audit"],
    },
    {
      front: "FDA premarket pathway showing substantial equivalence (acronym)?",
      back: "510(k)",
      tags: ["mdsap", "usa", "fda"],
    },
    {
      front: "FDA premarket pathway for high-risk class III devices (acronym)?",
      back: "PMA",
      tags: ["mdsap", "usa", "fda"],
    },
    {
      front: "21 CFR part that covered FDA's QSR (and now its QMSR)?",
      back: "820",
      tags: ["mdsap", "usa", "fda", "regulation"],
    },
  ]);
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

interface ReviewSeedConfig {
  // Cards in these decks are NOT given any review history. Showcase
  // (pristine demo of every editor) and rapid-fire (Survivors-friendly,
  // every card should start due) both opt out.
  excludeDeckIds: string[];
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

async function seedReviewHistory(config: ReviewSeedConfig): Promise<void> {
  // Grab every card in the demo set minus the opt-out decks. The previous
  // version queried by parent-deck id and missed every sub-deck card,
  // which is where almost every demo card actually lives — so the mature-
  // state pass only touched ~10% of cards. Querying flat-everything fixes
  // the mastery percentage.
  const exclude = new Set(config.excludeDeckIds);
  const allCards = await db.cards.filter((c) => !exclude.has(c.deckId)).toArray();
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

  // Mark ~40% of the seeded cards as mature in FSRS. Without this, all
  // cards stay "new" and overall mastery is stuck at 0%, so the Rank card
  // forever reads Unranked — which makes the demo flat. Bumping a chunk
  // into mature puts the demo profile somewhere around Practitioner /
  // Expert, which is what a real returning student would look like.
  const matureCount = Math.floor(allCards.length * 0.4);
  const matureUpdates = allCards.slice(0, matureCount).map((card) => ({
    id: card.id,
    fsrs: {
      ...card.fsrs,
      state: 2, // ts-fsrs State.Review
      reps: 4,
      lapses: 0,
      scheduled_days: 30,
      elapsed_days: 0,
      stability: 30,
      difficulty: 5,
    } as FsrsState,
  }));
  for (const u of matureUpdates) {
    await db.cards.update(u.id, { fsrs: u.fsrs });
  }

  // Streak: count consecutive non-rest active days at the tail of the
  // pattern. The DAILY_PATTERN has the rest day early on, so by today
  // we've got a 12-day run.
  const today = new Date(anchor);

  // Pre-fund coins so the demo profile can immediately try the theme
  // shop without having to grind. 300 is enough for any single 100 / 200
  // theme + still have some left.
  await db.profile.update("self", {
    streakDays,
    longestStreak: Math.max(streakDays, activeDays),
    lastReviewDate: isoLocalDate(today),
  });
  const profile = await db.profile.get("self");
  if (profile) {
    await db.profile.update("self", {
      settings: {
        ...profile.settings,
        coins: Math.max(profile.settings.coins ?? 0, 300),
      },
    });
  }
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
