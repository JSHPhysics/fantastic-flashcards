// Card save helpers. The repo layer (src/db/cards.ts) handles a single card
// CRUD; this module layers the multi-card concerns (auto-reverse pair, cloze
// fan-out) so components don't have to.

import {
  createCard,
  updateCard,
  deleteCard,
  db,
  type Card,
  type BasicContent,
  type ClozeContent,
  type McqContent,
  type TypedContent,
} from "../db";
import { clozeNumbersInOrder, renumberContiguously } from "./cloze";

interface CommonCardInput {
  deckId: string;
  tags: string[];
}

// ---- Basic ----

export interface BasicSaveInput extends CommonCardInput {
  front: BasicContent["front"];
  back: BasicContent["back"];
  autoReverse: boolean;
}

export async function createBasicCard(input: BasicSaveInput): Promise<Card> {
  const primary = await createCard({
    deckId: input.deckId,
    type: "basic",
    tags: input.tags,
    content: {
      type: "basic",
      front: input.front,
      back: input.back,
      autoReverse: input.autoReverse,
    },
  });
  if (input.autoReverse) {
    await createCard({
      deckId: input.deckId,
      type: "basic",
      tags: input.tags,
      content: {
        type: "basic",
        front: input.back,
        back: input.front,
        autoReverse: false,
      },
      generatedFromCardId: primary.id,
    });
  }
  return primary;
}

export async function updateBasicCard(
  cardId: string,
  input: BasicSaveInput,
): Promise<void> {
  // Update the primary card.
  await updateCard(cardId, {
    tags: input.tags,
    content: {
      type: "basic",
      front: input.front,
      back: input.back,
      autoReverse: input.autoReverse,
    },
  });

  // Reconcile the auto-reverse sibling. Look up siblings by
  // generatedFromCardId === this card.id (Playbook auto-reverse rule).
  const existingSibling = await db.cards
    .where("generatedFromCardId")
    .equals(cardId)
    .first();

  if (input.autoReverse) {
    if (existingSibling) {
      await updateCard(existingSibling.id, {
        tags: input.tags,
        content: {
          type: "basic",
          front: input.back,
          back: input.front,
          autoReverse: false,
        },
      });
    } else {
      await createCard({
        deckId: input.deckId,
        type: "basic",
        tags: input.tags,
        content: {
          type: "basic",
          front: input.back,
          back: input.front,
          autoReverse: false,
        },
        generatedFromCardId: cardId,
      });
    }
  } else if (existingSibling) {
    // User turned auto-reverse off: cascade delete the sibling.
    await deleteCard(existingSibling.id);
  }
}

// ---- Cloze ----

export interface ClozeSaveInput extends CommonCardInput {
  text: string;
  extra?: ClozeContent["extra"];
}

// On first creation, generate one card per distinct cloze number. The lowest
// numbered cloze (c1 after renumber) is the "root" with no generatedFromCardId;
// the rest reference the root so a future edit can find the full set and
// regenerate it atomically.
export async function createClozeCardSet(
  input: ClozeSaveInput,
): Promise<Card[]> {
  const text = renumberContiguously(input.text);
  const numbers = clozeNumbersInOrder(text);
  if (numbers.length === 0) {
    throw new Error("Cloze text contains no {{cN::...}} blanks");
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const created: Card[] = [];
  let rootId: string | undefined;
  for (const n of sorted) {
    const card = await createCard({
      deckId: input.deckId,
      type: "cloze",
      tags: input.tags,
      content: {
        type: "cloze",
        text,
        clozeNumber: n,
        extra: input.extra,
      },
      generatedFromCardId: rootId,
    });
    if (!rootId) rootId = card.id;
    created.push(card);
  }
  return created;
}

// Regenerate the entire cloze set. Finds the root (the card with no
// generatedFromCardId in the chain) then deletes root + siblings and re-creates.
export async function updateClozeCardSet(
  cardId: string,
  input: ClozeSaveInput,
): Promise<Card[]> {
  const card = await db.cards.get(cardId);
  if (!card) throw new Error("card not found");
  const rootId = card.generatedFromCardId ?? card.id;
  // Cascade delete clears the root and every generatedFrom sibling.
  await deleteCard(rootId);
  return createClozeCardSet(input);
}

// ---- MCQ ----

export interface McqSaveInput extends CommonCardInput {
  question: McqContent["question"];
  options: McqContent["options"];
  shuffleOptions: boolean;
  explanation?: McqContent["explanation"];
}

export async function createMcqCard(input: McqSaveInput): Promise<Card> {
  return createCard({
    deckId: input.deckId,
    type: "mcq",
    tags: input.tags,
    content: {
      type: "mcq",
      question: input.question,
      options: input.options,
      shuffleOptions: input.shuffleOptions,
      explanation: input.explanation,
    },
  });
}

export async function updateMcqCard(
  cardId: string,
  input: McqSaveInput,
): Promise<void> {
  await updateCard(cardId, {
    tags: input.tags,
    content: {
      type: "mcq",
      question: input.question,
      options: input.options,
      shuffleOptions: input.shuffleOptions,
      explanation: input.explanation,
    },
  });
}

// ---- Typed ----

export interface TypedSaveInput extends CommonCardInput {
  prompt: TypedContent["prompt"];
  acceptedAnswers: string[];
  caseSensitive: boolean;
  ignorePunctuation: boolean;
  explanation?: TypedContent["explanation"];
}

export async function createTypedCard(input: TypedSaveInput): Promise<Card> {
  return createCard({
    deckId: input.deckId,
    type: "typed",
    tags: input.tags,
    content: {
      type: "typed",
      prompt: input.prompt,
      acceptedAnswers: input.acceptedAnswers,
      caseSensitive: input.caseSensitive,
      ignorePunctuation: input.ignorePunctuation,
      explanation: input.explanation,
    },
  });
}

export async function updateTypedCard(
  cardId: string,
  input: TypedSaveInput,
): Promise<void> {
  await updateCard(cardId, {
    tags: input.tags,
    content: {
      type: "typed",
      prompt: input.prompt,
      acceptedAnswers: input.acceptedAnswers,
      caseSensitive: input.caseSensitive,
      ignorePunctuation: input.ignorePunctuation,
      explanation: input.explanation,
    },
  });
}
