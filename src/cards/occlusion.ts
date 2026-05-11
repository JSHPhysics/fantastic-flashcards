// Occlusion authoring service. One authoring action produces N cards - one
// per mask (or one per group, when groups are used). Every card shares the
// same imageHash and the same masks array; they differ only in activeMaskId.
//
// The lowest-id card in the chain is the "root" with no generatedFromCardId;
// the others reference the root via generatedFromCardId so deleteCard's
// cascade reaches the whole set when the user deletes any one of them, and
// so an edit on any card in the set can locate every sibling and rewrite.

import {
  createCard,
  updateCard,
  deleteCard,
  db,
  type Card,
  type OcclusionContent,
  type OcclusionMask,
} from "../db";

export interface OcclusionSaveInput {
  deckId: string;
  tags: string[];
  imageHash: string;
  masks: OcclusionMask[];
  mode: "hide-one" | "hide-all";
  extra?: OcclusionContent["extra"];
}

// Each card "activates" one mask (or one group, if the mask is grouped).
// Groups share an activeMaskId by convention: we use the lowest-id mask in
// the group. Callers building the saveInput pass the full masks array.
function activeMaskIdsForCards(masks: OcclusionMask[]): string[] {
  // Group masks share a groupId; ungrouped masks are their own group.
  const seenGroups = new Set<string>();
  const activeIds: string[] = [];
  for (const m of masks) {
    const key = m.groupId ?? m.id;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    activeIds.push(m.id);
  }
  return activeIds;
}

export async function createOcclusionCardSet(
  input: OcclusionSaveInput,
): Promise<Card[]> {
  if (input.masks.length === 0) {
    throw new Error("Need at least one mask before saving");
  }
  const activeIds = activeMaskIdsForCards(input.masks);

  const created: Card[] = [];
  let rootId: string | undefined;
  for (const activeMaskId of activeIds) {
    const card = await createCard({
      deckId: input.deckId,
      type: "occlusion",
      tags: input.tags,
      content: {
        type: "occlusion",
        imageHash: input.imageHash,
        masks: input.masks,
        activeMaskId,
        mode: input.mode,
        extra: input.extra,
      },
      generatedFromCardId: rootId,
    });
    if (!rootId) rootId = card.id;
    created.push(card);
  }
  return created;
}

// Editing any card in the set rewrites every card. Strategy: find the root,
// delete the whole chain (which releases media refs once per card), then
// re-create. Cards lose their FSRS state which is acceptable for v1 (matches
// how updateClozeCardSet works).
export async function updateOcclusionCardSet(
  cardId: string,
  input: OcclusionSaveInput,
): Promise<Card[]> {
  const card = await db.cards.get(cardId);
  if (!card) throw new Error("card not found");
  const rootId = card.generatedFromCardId ?? card.id;
  await deleteCard(rootId);
  return createOcclusionCardSet(input);
}

// Lookup every sibling card sharing the same root. Used by the editor to
// detect when the user is editing an existing set so it can re-apply the
// rewrite path.
export async function findOcclusionSiblings(cardId: string): Promise<Card[]> {
  const card = await db.cards.get(cardId);
  if (!card) return [];
  const rootId = card.generatedFromCardId ?? card.id;
  const root = await db.cards.get(rootId);
  if (!root) return [];
  const generated = await db.cards
    .where("generatedFromCardId")
    .equals(rootId)
    .toArray();
  return [root, ...generated];
}

// Silently no-op fallback so an in-progress edit can be cancelled cleanly.
export async function reorderActiveMask(
  cardId: string,
  newActiveMaskId: string,
): Promise<void> {
  const card = await db.cards.get(cardId);
  if (!card || card.content.type !== "occlusion") return;
  const next: OcclusionContent = { ...card.content, activeMaskId: newActiveMaskId };
  await updateCard(cardId, { content: next });
}
