import { useRef } from "react";
import type { ClozeContent } from "../../db";
import { FormField, textareaClass, noAutoFill } from "../FormField";
import {
  clozeNumbersInOrder,
  renderClozePreview,
  wrapSelectionAsCloze,
} from "../../cards/cloze";

export interface ClozeDraft {
  text: string;
}

interface Props {
  draft: ClozeDraft;
  onChange: (next: ClozeDraft) => void;
  // When editing one card from an existing set, lock the underlying text and
  // let only the metadata change. For Session 4 we just regenerate the whole
  // set on save, so we don't need the lock; surfaced as a prop for future use.
  readOnlyText?: boolean;
}

export function ClozeForm({ draft, onChange, readOnlyText }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertCloze = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? draft.text.length;
    const end = ta.selectionEnd ?? draft.text.length;
    const { text, cursorAt } = wrapSelectionAsCloze(draft.text, start, end);
    onChange({ text });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(cursorAt, cursorAt);
    });
  };

  const numbers = clozeNumbersInOrder(draft.text);

  return (
    <div className="space-y-4">
      <FormField
        label="Text"
        hint="Type your text, then select what you want hidden and tap the button below. Multiple blanks (c1, c2, c3...) are numbered automatically."
        htmlFor="cloze-text"
      >
        <textarea
          id="cloze-text"
          ref={textareaRef}
          value={draft.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={5}
          readOnly={readOnlyText}
          className={textareaClass}
          autoFocus
          {...noAutoFill}
        />
      </FormField>
      <div>
        <button
          type="button"
          onClick={insertCloze}
          disabled={readOnlyText}
          className="tap-target inline-flex items-center justify-center gap-2 rounded-xl border border-ink-300 bg-surface px-4 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold dark:hover:bg-dark-surface/70 disabled:opacity-50"
        >
          Hide selected text
        </button>
        <p className="mt-2 text-xs text-ink-500 dark:text-ink-300">
          {numbers.length === 0
            ? "No blanks yet - select some text and tap the button to add one."
            : `${numbers.length} blank${numbers.length === 1 ? "" : "s"} so far. Saving will create ${numbers.length} card${numbers.length === 1 ? "" : "s"} (one per blank).`}
        </p>
      </div>
    </div>
  );
}

export function defaultClozeDraft(): ClozeDraft {
  return { text: "" };
}

export function clozeDraftFromContent(c: ClozeContent): ClozeDraft {
  return { text: c.text };
}

export function clozeDraftValid(d: ClozeDraft): boolean {
  return clozeNumbersInOrder(d.text).length > 0;
}

// Preview a single masked variant. Numbers are listed; preview cycles via tabs.
export function ClozePreview({
  draft,
  focused,
  onFocusChange,
}: {
  draft: ClozeDraft;
  focused: number | undefined;
  onFocusChange: (n: number) => void;
}) {
  const numbers = clozeNumbersInOrder(draft.text);
  if (numbers.length === 0) {
    return (
      <div className="card-surface p-4 text-sm text-ink-500">
        Select some text and tap "Hide selected text" to create your first
        blank, then a preview will appear here.
      </div>
    );
  }
  const current = focused && numbers.includes(focused) ? focused : numbers[0];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onFocusChange(n)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              n === current
                ? "bg-navy text-cream"
                : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
            }`}
          >
            c{n}
          </button>
        ))}
      </div>
      <div className="card-surface p-4">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Card for blank {current}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
          {renderClozePreview(draft.text, current)}
        </p>
      </div>
    </div>
  );
}
