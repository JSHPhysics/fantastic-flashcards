// Parser for Quizlet's "Export to text" output.
//
// Quizlet's export dialog lets the user choose any separators they like, so
// we accept them as parameters rather than hard-coding tab + newline. The
// defaults (tab between term and definition, newline between cards) match
// Quizlet's own defaults, which most users won't change.
//
// Edge cases handled:
// - Empty lines (blank rows between cards) are skipped.
// - Lines with no separator are skipped (skipping seems safer than
//   guessing).
// - If a definition itself contains the term separator (rare but
//   possible), parts after the first separator are re-joined.
// - Leading / trailing whitespace on each side is trimmed.

export interface ParsedCard {
  front: string;
  back: string;
}

export interface QuizletParseOptions {
  termSeparator: string;
  cardSeparator: string;
}

export const QUIZLET_DEFAULT_OPTIONS: QuizletParseOptions = {
  termSeparator: "\t",
  cardSeparator: "\n",
};

export interface ParseResult {
  cards: ParsedCard[];
  // Lines that looked like they should have been cards but didn't parse
  // (e.g. no separator), shown to the user so they can fix the export
  // settings if there are many.
  skipped: number;
}

export function parseQuizletExport(
  text: string,
  options: QuizletParseOptions = QUIZLET_DEFAULT_OPTIONS,
): ParseResult {
  const { termSeparator, cardSeparator } = options;
  if (!termSeparator || !cardSeparator) {
    return { cards: [], skipped: 0 };
  }

  const lines = text.split(cardSeparator);
  const cards: ParsedCard[] = [];
  let skipped = 0;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, ""); // tolerate CRLF input
    if (line.trim() === "") continue;
    const idx = line.indexOf(termSeparator);
    if (idx === -1) {
      skipped += 1;
      continue;
    }
    const front = line.slice(0, idx).trim();
    const back = line.slice(idx + termSeparator.length).trim();
    if (!front || !back) {
      skipped += 1;
      continue;
    }
    cards.push({ front, back });
  }
  return { cards, skipped };
}
