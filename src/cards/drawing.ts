// Drawing-card service. One card per drawing; the model answer is rendered
// from the editor's Konva stage to a WebP blob, hashed, and stored via the
// usual storeMedia pipeline. The card stores only the hash.

import {
  createCard,
  updateCard,
  storeMedia,
  db,
  type Card,
  type DrawingContent,
} from "../db";
import { sha256Hex } from "../media/hash";

export interface DrawingSaveInput {
  deckId: string;
  tags: string[];
  prompt: DrawingContent["prompt"];
  backgroundImageHash?: string;
  // PNG / WebP blob of the model answer. Caller (editor) builds this from
  // its Konva stage via stage.toDataURL() and a small dataURL -> Blob
  // conversion. We hash + store here.
  modelAnswerBlob: Blob;
  revealMode: DrawingContent["revealMode"];
  extra?: DrawingContent["extra"];
}

async function persistModelAnswer(blob: Blob): Promise<string> {
  const hash = await sha256Hex(blob);
  await storeMedia({
    hash,
    blob,
    mimeType: blob.type || "image/webp",
    bytes: blob.size,
  });
  return hash;
}

export async function createDrawingCard(
  input: DrawingSaveInput,
): Promise<Card> {
  const modelAnswerImageHash = await persistModelAnswer(input.modelAnswerBlob);
  return createCard({
    deckId: input.deckId,
    type: "drawing",
    tags: input.tags,
    content: {
      type: "drawing",
      prompt: input.prompt,
      backgroundImageHash: input.backgroundImageHash,
      modelAnswerImageHash,
      revealMode: input.revealMode,
      extra: input.extra,
    },
  });
}

export async function updateDrawingCard(
  cardId: string,
  input: DrawingSaveInput,
): Promise<void> {
  const card = await db.cards.get(cardId);
  if (!card || card.content.type !== "drawing") {
    throw new Error("card not found or not a drawing card");
  }
  const modelAnswerImageHash = await persistModelAnswer(input.modelAnswerBlob);
  const next: DrawingContent = {
    type: "drawing",
    prompt: input.prompt,
    backgroundImageHash: input.backgroundImageHash,
    modelAnswerImageHash,
    revealMode: input.revealMode,
    extra: input.extra,
  };
  await updateCard(cardId, { content: next, tags: input.tags });
}

// Helper for the editor: convert a Konva-produced dataURL into a Blob the
// service can hash and store. Browsers expose this through fetch().
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}
