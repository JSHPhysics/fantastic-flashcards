// Compare a student's typed answer against the card's accepted answers.
// Returns the inferred rating per Playbook section 7:
//   exact match -> Good (3)
//   close (Levenshtein <= 2) -> Hard (2)
//   else -> Again (1)
// Easy (4) isn't inferred from typing; the student can pick it manually if
// the UI exposes a self-override.

import type { TypedContent } from "../db";

export interface TypedMatchResult {
  rating: 1 | 2 | 3;
  matchedAnswer?: string;
  closest?: string;
  distance: number;
}

export function compareTypedAnswer(
  input: string,
  content: TypedContent,
): TypedMatchResult {
  const normalizedInput = normalise(input, content);

  let bestDistance = Infinity;
  let bestAnswer: string | undefined;
  for (const accepted of content.acceptedAnswers) {
    const normAccepted = normalise(accepted, content);
    if (normAccepted === normalizedInput) {
      return {
        rating: 3,
        matchedAnswer: accepted,
        distance: 0,
      };
    }
    const d = levenshtein(normalizedInput, normAccepted);
    if (d < bestDistance) {
      bestDistance = d;
      bestAnswer = accepted;
    }
  }

  if (bestDistance <= 2) {
    return {
      rating: 2,
      closest: bestAnswer,
      distance: bestDistance,
    };
  }
  return {
    rating: 1,
    closest: bestAnswer,
    distance: bestDistance,
  };
}

function normalise(s: string, content: TypedContent): string {
  let t = s.trim();
  if (!content.caseSensitive) t = t.toLowerCase();
  if (content.ignorePunctuation) {
    t = t.replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  }
  return t;
}

// Standard iterative Levenshtein with O(min(a,b)) memory.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}
