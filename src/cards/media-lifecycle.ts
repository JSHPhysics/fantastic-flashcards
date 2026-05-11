// Walks card content to find every media hash it references. Used to reconcile
// media refCounts when cards are created, updated, or deleted, and to compute
// per-deck mediaBytes.

import type { CardContent, RichField } from "../db";

function fromRich(field: RichField | undefined, into: Set<string>) {
  if (!field) return;
  if (field.imageHash) into.add(field.imageHash);
  if (field.audioHash) into.add(field.audioHash);
}

export function hashesInContent(content: CardContent): string[] {
  const set = new Set<string>();
  switch (content.type) {
    case "basic":
      fromRich(content.front, set);
      fromRich(content.back, set);
      break;
    case "cloze":
      fromRich(content.extra, set);
      break;
    case "mcq":
      fromRich(content.question, set);
      fromRich(content.explanation, set);
      break;
    case "typed":
      fromRich(content.prompt, set);
      fromRich(content.explanation, set);
      break;
    case "occlusion":
      set.add(content.imageHash);
      fromRich(content.extra, set);
      break;
    case "drawing":
      if (content.backgroundImageHash) set.add(content.backgroundImageHash);
      set.add(content.modelAnswerImageHash);
      fromRich(content.prompt, set);
      fromRich(content.extra, set);
      break;
  }
  return [...set];
}

// Compute set difference; useful for delta-based ref counting on edit.
export function diffHashes(
  before: string[],
  after: string[],
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const added: string[] = [];
  const removed: string[] = [];
  for (const h of afterSet) if (!beforeSet.has(h)) added.push(h);
  for (const h of beforeSet) if (!afterSet.has(h)) removed.push(h);
  return { added, removed };
}
