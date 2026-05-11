import { useMemo, useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { LANGUAGE_OPTIONS, labelForLanguage } from "../tts/languages";

interface LanguagePickerProps {
  open: boolean;
  onClose: () => void;
  value: string | undefined;
  // When supplied, an extra "Use deck default" option resets `value` to undefined.
  // The deck's language is shown in parens.
  deckDefault?: string;
  onChange: (next: string | undefined) => void;
  title?: string;
}

// Dialog with search + curated list. "None" clears the language; "Deck default"
// (when offered) clears the per-field override so it falls back to the deck.

export function LanguagePicker({
  open,
  onClose,
  value,
  deckDefault,
  onChange,
  title,
}: LanguagePickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGE_OPTIONS;
    return LANGUAGE_OPTIONS.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title ?? "Pronunciation language"}
      description="Used by the speaker icon and review-time auto-speak."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search languages..."
          className="w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
        />
        <ul className="max-h-72 overflow-y-auto rounded-xl border border-ink-100 dark:border-dark-surface">
          {deckDefault !== undefined && (
            <PickerRow
              label={`Use deck default (${labelForLanguage(deckDefault)})`}
              active={value === undefined}
              onClick={() => {
                onChange(undefined);
                onClose();
              }}
            />
          )}
          {deckDefault === undefined && (
            <PickerRow
              label="None"
              active={value === undefined}
              onClick={() => {
                onChange(undefined);
                onClose();
              }}
            />
          )}
          {filtered.map((opt) => (
            <PickerRow
              key={opt.code}
              label={`${opt.label} - ${opt.code}`}
              active={value === opt.code}
              onClick={() => {
                onChange(opt.code);
                onClose();
              }}
            />
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-ink-500">
              No matches. Try a different search.
            </li>
          )}
        </ul>
      </div>
    </Dialog>
  );
}

function PickerRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`tap-target flex w-full items-center justify-between border-b border-ink-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-ink-100/50 dark:border-dark-surface dark:hover:bg-dark-surface/40 ${
          active ? "bg-gold/10 text-navy dark:text-gold" : ""
        }`}
      >
        <span>{label}</span>
        {active && (
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M5 12l4 4L19 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </li>
  );
}
