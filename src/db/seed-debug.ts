// User-triggered "fill the app with stuff to play with" seed. Reached from
// Settings -> Debug -> Generate sample decks once debug mode is on. Distinct
// from the auto-run dev seed (src/db/seed.ts) which is intentionally tiny.
//
// All decks created here are prefixed "[debug]" so the seeder can detect
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

export interface SeedDebugResult {
  decksCreated: number;
  cardsCreated: number;
  alreadySeeded: boolean;
}

const DEBUG_PREFIX = "[debug]";

async function debugDecksExist(): Promise<boolean> {
  const all = await db.decks.toArray();
  return all.some((d) => d.name.startsWith(DEBUG_PREFIX));
}

export async function seedDebugData(): Promise<SeedDebugResult> {
  if (await debugDecksExist()) {
    return { decksCreated: 0, cardsCreated: 0, alreadySeeded: true };
  }

  let cards = 0;
  let decks = 0;

  // ---- French ----
  const french = await createDeck({
    name: `${DEBUG_PREFIX} FR · Vocabulaire`,
    description: "French vocabulary - exercises TTS on accented characters.",
    subject: "French",
    colour: "#3D7AB8",
    pronunciationLanguage: "fr-FR",
    secondaryLanguage: "en-US",
  });
  decks++;
  for (const [front, back] of [
    ["café", "coffee"],
    ["être", "to be"],
    ["garçon", "boy"],
    ["hôtel", "hotel"],
    ["cœur", "heart"],
    ["fenêtre", "window"],
  ] as const) {
    await createBasicCard({
      deckId: french.id,
      tags: ["fr", "vocab"],
      // Both sides carry an explicit language so each speaker icon picks the
      // correct voice. Without back.language, it would fall back to the
      // deck's pronunciationLanguage and read the English gloss with a
      // French voice.
      front: { text: front, language: "fr-FR" },
      back: { text: back, language: "en-US" },
      autoReverse: true,
    });
    cards += 2; // primary + auto-reverse sibling
  }

  // ---- Spanish ----
  const spanish = await createDeck({
    name: `${DEBUG_PREFIX} ES · Vocabulario`,
    description: "Spanish vocabulary including ñ, ¿, ¡.",
    subject: "Spanish",
    colour: "#C9A14A",
    pronunciationLanguage: "es-ES",
    secondaryLanguage: "en-US",
  });
  decks++;
  for (const [front, back] of [
    ["mañana", "morning / tomorrow"],
    ["año", "year"],
    ["corazón", "heart"],
    ["señor", "sir / mister"],
    ["¿cómo estás?", "how are you?"],
    ["¡hola!", "hello!"],
  ] as const) {
    await createBasicCard({
      deckId: spanish.id,
      tags: ["es", "vocab"],
      front: { text: front, language: "es-ES" },
      back: { text: back, language: "en-US" },
      autoReverse: true,
    });
    cards += 2;
  }

  // ---- German ----
  const german = await createDeck({
    name: `${DEBUG_PREFIX} DE · Wortschatz`,
    description: "German vocabulary including umlauts and ß.",
    subject: "German",
    colour: "#3E8E63",
    pronunciationLanguage: "de-DE",
    secondaryLanguage: "en-US",
  });
  decks++;
  for (const [front, back] of [
    ["schön", "beautiful"],
    ["Käse", "cheese"],
    ["Tür", "door"],
    ["Größe", "size"],
    ["heißen", "to be called"],
    ["Übung", "exercise"],
  ] as const) {
    await createBasicCard({
      deckId: german.id,
      tags: ["de", "vocab"],
      front: { text: front, language: "de-DE" },
      back: { text: back, language: "en-US" },
      autoReverse: true,
    });
    cards += 2;
  }

  // ---- All card types (English, no pronunciation language) ----
  const allTypes = await createDeck({
    name: `${DEBUG_PREFIX} All card types`,
    description: "One card per text type so you can exercise every editor flow.",
    subject: "Demo",
    colour: "#7A5BA8",
  });
  decks++;

  // Basic
  await createBasicCard({
    deckId: allTypes.id,
    tags: ["demo", "basic"],
    front: { text: "What is the speed of light in a vacuum?" },
    back: { text: "Approximately 3 × 10⁸ m/s." },
    autoReverse: false,
  });
  cards++;

  // Cloze with two blanks
  const clozeCards = await createClozeCardSet({
    deckId: allTypes.id,
    tags: ["demo", "cloze"],
    text:
      "Newton's first law: an object in motion stays in motion unless acted on by {{c1::a net force}}. Newton's second law gives us {{c2::F = ma}}.",
  });
  cards += clozeCards.length;

  // MCQ
  await createMcqCard({
    deckId: allTypes.id,
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
  cards++;

  // Typed
  await createTypedCard({
    deckId: allTypes.id,
    tags: ["demo", "typed"],
    prompt: { text: "What is 7 + 5?" },
    acceptedAnswers: ["12", "twelve"],
    caseSensitive: false,
    ignorePunctuation: true,
  });
  cards++;

  return { decksCreated: decks, cardsCreated: cards, alreadySeeded: false };
}

// Wipe absolutely everything: profile, decks, cards, media, reviews, sessions.
// Used by the Debug "Wipe all local data" button after a confirm dialog.
// Reloads the page so the bootstrap rerun creates a fresh profile.
export async function wipeAllData(): Promise<void> {
  await db.delete();
  location.reload();
}
