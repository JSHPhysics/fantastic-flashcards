// Cloze deletion helpers. Syntax: {{cN::hidden text}} where N is a 1-indexed
// integer. Multiple cN markers can share the same N (they're revealed together
// at review time). Each distinct N becomes one Card at save time.

const CLOZE_PATTERN = /\{\{c(\d+)::([\s\S]+?)\}\}/g;

export interface ClozeMatch {
  number: number;
  hidden: string;
  index: number;
  length: number;
}

export function parseClozeMatches(text: string): ClozeMatch[] {
  const matches: ClozeMatch[] = [];
  for (const m of text.matchAll(CLOZE_PATTERN)) {
    matches.push({
      number: Number(m[1]),
      hidden: m[2],
      index: m.index ?? 0,
      length: m[0].length,
    });
  }
  return matches;
}

// Distinct cloze numbers in the order they first appear.
export function clozeNumbersInOrder(text: string): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const m of parseClozeMatches(text)) {
    if (!seen.has(m.number)) {
      seen.add(m.number);
      order.push(m.number);
    }
  }
  return order;
}

// Returns a numeric c-number for the next cloze given current text.
// Picks max(existing) + 1, or 1 if none.
export function nextClozeNumber(text: string): number {
  const nums = clozeNumbersInOrder(text);
  if (nums.length === 0) return 1;
  return Math.max(...nums) + 1;
}

// Wrap a selected substring in {{cN::...}}, using nextClozeNumber by default.
// If the selection is already wrapped (e.g. user re-selected a cloze), this
// is the caller's problem — kept dumb on purpose.
export function wrapSelectionAsCloze(
  fullText: string,
  selectionStart: number,
  selectionEnd: number,
  clozeNumber?: number,
): { text: string; cursorAt: number } {
  const before = fullText.slice(0, selectionStart);
  const selected = fullText.slice(selectionStart, selectionEnd);
  const after = fullText.slice(selectionEnd);
  const n = clozeNumber ?? nextClozeNumber(fullText);
  const insertion = `{{c${n}::${selected || "..."}}}`;
  return {
    text: `${before}${insertion}${after}`,
    cursorAt: before.length + insertion.length,
  };
}

// Re-number clozes contiguously from 1 in order-of-first-appearance.
// Used on save to keep the data clean even if the author skipped numbers.
export function renumberContiguously(text: string): string {
  const order = clozeNumbersInOrder(text);
  if (order.length === 0) return text;
  const remap = new Map<number, number>();
  order.forEach((n, idx) => remap.set(n, idx + 1));
  return text.replace(CLOZE_PATTERN, (_full, nStr: string, body: string) => {
    const fromN = Number(nStr);
    const toN = remap.get(fromN) ?? fromN;
    return `{{c${toN}::${body}}}`;
  });
}

// Render preview: any cloze whose number is `maskedNumber` shows as [...];
// other clozes show their hidden text in brackets so the author can see
// what's revealed.
export function renderClozePreview(
  text: string,
  maskedNumber: number,
): string {
  return text.replace(CLOZE_PATTERN, (_full, nStr: string, body: string) => {
    const n = Number(nStr);
    return n === maskedNumber ? "[...]" : body;
  });
}
