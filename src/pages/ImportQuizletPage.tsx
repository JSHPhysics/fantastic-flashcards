import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DECK_COLOURS, createDeck, useDecks } from "../db";
import { createBasicCard } from "../cards/service";
import { Button } from "../components/Button";
import { FormField, inputClass, textareaClass } from "../components/FormField";
import { TagsInput } from "../components/TagsInput";
import {
  parseQuizletExport,
  type ParseResult,
} from "../imports/quizletParser";

type TermSepChoice = "tab" | "comma" | "custom";
type CardSepChoice = "newline" | "semicolon" | "custom";

interface SeparatorState {
  termChoice: TermSepChoice;
  termCustom: string;
  cardChoice: CardSepChoice;
  cardCustom: string;
}

export function ImportQuizletPage() {
  const navigate = useNavigate();
  const decks = useDecks();

  const [text, setText] = useState("");
  const [seps, setSeps] = useState<SeparatorState>({
    termChoice: "tab",
    termCustom: "",
    cardChoice: "newline",
    cardCustom: "",
  });

  // Target deck: existing or new. "new" creates one inline.
  const [targetMode, setTargetMode] = useState<"existing" | "new">("existing");
  const [targetDeckId, setTargetDeckId] = useState<string | undefined>();
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckColour, setNewDeckColour] = useState<string>(DECK_COLOURS[0]);

  const [tags, setTags] = useState<string[]>([]);
  const [autoReverse, setAutoReverse] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-pick the first deck when the list loads, so the dropdown isn't
  // empty for users with existing decks.
  useEffect(() => {
    if (!decks) return;
    if (decks.length === 0) {
      setTargetMode("new");
    } else if (!targetDeckId) {
      setTargetDeckId(decks[0].id);
    }
  }, [decks, targetDeckId]);

  const options = useMemo(
    () => ({
      termSeparator: resolveTermSeparator(seps),
      cardSeparator: resolveCardSeparator(seps),
    }),
    [seps],
  );

  const result: ParseResult = useMemo(
    () => parseQuizletExport(text, options),
    [text, options],
  );

  const canImport =
    result.cards.length > 0 &&
    !busy &&
    (targetMode === "existing"
      ? Boolean(targetDeckId)
      : newDeckName.trim().length > 0);

  const handleImport = async () => {
    if (!canImport) return;
    setBusy(true);
    setError(null);
    try {
      let deckId = targetDeckId;
      if (targetMode === "new") {
        const newDeck = await createDeck({
          name: newDeckName.trim(),
          colour: newDeckColour,
        });
        deckId = newDeck.id;
      }
      if (!deckId) throw new Error("No target deck selected");

      for (const card of result.cards) {
        await createBasicCard({
          deckId,
          tags,
          front: { text: card.front },
          back: { text: card.back },
          autoReverse,
        });
      }

      navigate(`/decks/${deckId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <Link
          to="/"
          className="text-sm text-ink-500 hover:underline dark:text-ink-300"
        >
          ← Home
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy dark:text-gold">
          Import from Quizlet
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          Paste a Quizlet "Export" below and we'll turn it into Basic cards.
        </p>
      </header>

      <details className="card-surface p-4 text-sm text-ink-700 dark:text-ink-300">
        <summary className="cursor-pointer text-ink-900 dark:text-dark-ink">
          How to get your Quizlet export
        </summary>
        <ol className="ml-5 mt-2 list-decimal space-y-1">
          <li>Open your set on Quizlet.</li>
          <li>
            Click the ... (more) menu above the set and choose Export.
          </li>
          <li>
            Leave the defaults (Tab between term and definition; New line
            between cards) and tap "Copy text".
          </li>
          <li>Come back here and paste it into the box below.</li>
        </ol>
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-300">
          If you changed the separators in Quizlet, match them below. The
          preview updates as you type.
        </p>
      </details>

      <FormField label="Paste your Quizlet export" htmlFor="quizlet-text">
        <textarea
          id="quizlet-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`bonjour\thello\nmerci\tthank you\n...`}
          className={textareaClass}
          spellCheck={false}
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Between term and definition">
          <SeparatorChoice
            value={seps.termChoice}
            custom={seps.termCustom}
            options={[
              { value: "tab", label: "Tab" },
              { value: "comma", label: "Comma" },
              { value: "custom", label: "Custom" },
            ]}
            onValueChange={(v) =>
              setSeps((s) => ({ ...s, termChoice: v as TermSepChoice }))
            }
            onCustomChange={(c) =>
              setSeps((s) => ({ ...s, termCustom: c }))
            }
          />
        </FormField>
        <FormField label="Between cards">
          <SeparatorChoice
            value={seps.cardChoice}
            custom={seps.cardCustom}
            options={[
              { value: "newline", label: "New line" },
              { value: "semicolon", label: "Semicolon" },
              { value: "custom", label: "Custom" },
            ]}
            onValueChange={(v) =>
              setSeps((s) => ({ ...s, cardChoice: v as CardSepChoice }))
            }
            onCustomChange={(c) =>
              setSeps((s) => ({ ...s, cardCustom: c }))
            }
          />
        </FormField>
      </div>

      <FormField
        label={`Preview (${result.cards.length} card${result.cards.length === 1 ? "" : "s"} ready to import${result.skipped > 0 ? `, ${result.skipped} line${result.skipped === 1 ? "" : "s"} skipped` : ""})`}
      >
        {result.cards.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-300">
            {text.trim() === ""
              ? "Paste some text above to see the cards we'd create."
              : "Couldn't find any cards. Check the separators match what Quizlet exported."}
          </p>
        ) : (
          <PreviewTable cards={result.cards} maxRows={8} />
        )}
      </FormField>

      <FormField label="Add the imported cards to">
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="target-mode"
              checked={targetMode === "existing"}
              onChange={() => setTargetMode("existing")}
              className="h-4 w-4 accent-navy"
            />
            <span className="text-sm text-ink-900 dark:text-dark-ink">
              An existing deck
            </span>
          </label>
          {targetMode === "existing" && (
            <select
              value={targetDeckId ?? ""}
              onChange={(e) => setTargetDeckId(e.target.value)}
              className={inputClass}
              disabled={!decks || decks.length === 0}
            >
              {!decks || decks.length === 0 ? (
                <option>No existing decks yet</option>
              ) : (
                decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
          )}

          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="target-mode"
              checked={targetMode === "new"}
              onChange={() => setTargetMode("new")}
              className="h-4 w-4 accent-navy"
            />
            <span className="text-sm text-ink-900 dark:text-dark-ink">
              A new deck
            </span>
          </label>
          {targetMode === "new" && (
            <div className="space-y-3 rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
              <input
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                placeholder="New deck name"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                {DECK_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    aria-pressed={newDeckColour === c}
                    onClick={() => setNewDeckColour(c)}
                    className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition-all ${
                      newDeckColour === c
                        ? "ring-navy"
                        : "ring-transparent hover:ring-ink-300"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="text-xs text-ink-500 dark:text-ink-300">
                You can rename, add a description, or set a language pair on
                the deck after importing.
              </p>
            </div>
          )}
        </div>
      </FormField>

      <FormField label="Optional tags for every imported card">
        <TagsInput value={tags} onChange={setTags} />
      </FormField>

      <FormField label="Behaviour">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={autoReverse}
            onChange={(e) => setAutoReverse(e.target.checked)}
            className="mt-1 h-4 w-4 accent-navy"
          />
          <span className="text-sm">
            <span className="block text-ink-900 dark:text-dark-ink">
              Also create a reverse card for each pair
            </span>
            <span className="block text-xs text-ink-500 dark:text-ink-300">
              Matches Quizlet's "study both sides" behaviour. Doubles the card
              count.
            </span>
          </span>
        </label>
      </FormField>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleImport} disabled={!canImport}>
          {busy
            ? "Importing..."
            : `Import ${result.cards.length} card${result.cards.length === 1 ? "" : "s"}${autoReverse ? " (×2 with reverse)" : ""}`}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")}>
          Cancel
        </Button>
        {error && (
          <p role="alert" className="text-sm text-again">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function SeparatorChoice<T extends string>({
  value,
  custom,
  options,
  onValueChange,
  onCustomChange,
}: {
  value: T;
  custom: string;
  options: { value: T; label: string }[];
  onValueChange: (v: T) => void;
  onCustomChange: (c: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onValueChange(opt.value)}
            className={`tap-target rounded-full px-3 text-xs font-semibold transition-colors ${
              value === opt.value
                ? "bg-navy text-cream"
                : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value === ("custom" as T) && (
        <input
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Type the character(s)"
          maxLength={6}
          className={inputClass}
        />
      )}
    </div>
  );
}

function PreviewTable({
  cards,
  maxRows,
}: {
  cards: { front: string; back: string }[];
  maxRows: number;
}) {
  const shown = cards.slice(0, maxRows);
  const remaining = cards.length - shown.length;
  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 dark:border-dark-surface">
      <table className="w-full text-sm">
        <thead className="bg-ink-100/60 text-ink-700 dark:bg-dark-surface dark:text-ink-300">
          <tr>
            <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
              Front
            </th>
            <th className="px-3 py-2 text-left text-xs uppercase tracking-wider">
              Back
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100 dark:divide-dark-surface">
          {shown.map((c, idx) => (
            <tr key={idx} className="bg-surface dark:bg-dark-bg">
              <td className="px-3 py-2 align-top text-ink-900 dark:text-dark-ink">
                {c.front}
              </td>
              <td className="px-3 py-2 align-top text-ink-700 dark:text-ink-300">
                {c.back}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 && (
        <p className="border-t border-ink-100 bg-cream/30 px-3 py-2 text-xs text-ink-500 dark:border-dark-surface dark:bg-dark-bg/40 dark:text-ink-300">
          ...and {remaining} more
        </p>
      )}
    </div>
  );
}

function resolveTermSeparator(seps: SeparatorState): string {
  switch (seps.termChoice) {
    case "tab":
      return "\t";
    case "comma":
      return ",";
    case "custom":
      return seps.termCustom;
  }
}

function resolveCardSeparator(seps: SeparatorState): string {
  switch (seps.cardChoice) {
    case "newline":
      return "\n";
    case "semicolon":
      return ";";
    case "custom":
      return seps.cardCustom;
  }
}

