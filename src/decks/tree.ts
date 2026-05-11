import type { Deck } from "../db";

// Pure helpers for shaping flat deck lists into a tree.
// Pulled out of components so they're testable and reusable across screens.

export interface DeckNode {
  deck: Deck;
  depth: number;
  children: DeckNode[];
}

export function buildDeckTree(decks: Deck[]): DeckNode[] {
  const sorted = [...decks].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const byParent = new Map<string | undefined, Deck[]>();
  for (const d of sorted) {
    const key = d.parentId;
    const list = byParent.get(key);
    if (list) list.push(d);
    else byParent.set(key, [d]);
  }
  const build = (parentId: string | undefined, depth: number): DeckNode[] => {
    return (byParent.get(parentId) ?? []).map((deck) => ({
      deck,
      depth,
      children: build(deck.id, depth + 1),
    }));
  };
  return build(undefined, 1);
}

// Flatten a node and its descendants depth-first into a single list. Used for
// the move-target picker so we can render with indentation in one pass.
export function flattenTree(nodes: DeckNode[]): DeckNode[] {
  const out: DeckNode[] = [];
  const walk = (list: DeckNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

// Returns true if `candidateAncestorId` is the deck itself or an ancestor of
// `descendantId`. Used to forbid moving a deck under its own descendant.
export function isAncestor(
  decks: Deck[],
  candidateAncestorId: string,
  descendantId: string,
): boolean {
  const byId = new Map(decks.map((d) => [d.id, d]));
  let current: Deck | undefined = byId.get(descendantId);
  while (current) {
    if (current.id === candidateAncestorId) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}
