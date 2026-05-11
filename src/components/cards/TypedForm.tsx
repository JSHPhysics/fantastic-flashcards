import type { RichField, TypedContent } from "../../db";
import { FormField, inputClass } from "../FormField";
import { RichFieldEditor } from "../media/RichFieldEditor";

export interface TypedDraft {
  prompt: RichField;
  acceptedAnswersRaw: string; // comma separated
  caseSensitive: boolean;
  ignorePunctuation: boolean;
}

interface Props {
  draft: TypedDraft;
  onChange: (next: TypedDraft) => void;
}

export function TypedForm({ draft, onChange }: Props) {
  return (
    <div className="space-y-4">
      <FormField label="Prompt" htmlFor="typed-prompt">
        <RichFieldEditor
          id="typed-prompt"
          value={draft.prompt}
          onChange={(prompt) => onChange({ ...draft, prompt })}
          autoFocus
        />
      </FormField>
      <FormField
        label="Accepted answers"
        hint="Comma-separated. Any one is correct."
        htmlFor="typed-answers"
      >
        <input
          id="typed-answers"
          value={draft.acceptedAnswersRaw}
          onChange={(e) =>
            onChange({ ...draft, acceptedAnswersRaw: e.target.value })
          }
          placeholder="e.g. bonjour, salut"
          className={inputClass}
        />
      </FormField>
      <div className="space-y-2">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={draft.caseSensitive}
            onChange={(e) =>
              onChange({ ...draft, caseSensitive: e.target.checked })
            }
            className="mt-1 h-4 w-4 accent-navy"
          />
          <span className="text-sm text-ink-900 dark:text-dark-ink">
            Case sensitive
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={draft.ignorePunctuation}
            onChange={(e) =>
              onChange({ ...draft, ignorePunctuation: e.target.checked })
            }
            className="mt-1 h-4 w-4 accent-navy"
          />
          <span className="text-sm text-ink-900 dark:text-dark-ink">
            Ignore punctuation when comparing
          </span>
        </label>
      </div>
    </div>
  );
}

export function defaultTypedDraft(): TypedDraft {
  return {
    prompt: { text: "" },
    acceptedAnswersRaw: "",
    caseSensitive: false,
    ignorePunctuation: true,
  };
}

export function typedDraftFromContent(c: TypedContent): TypedDraft {
  return {
    prompt: { ...c.prompt },
    acceptedAnswersRaw: c.acceptedAnswers.join(", "),
    caseSensitive: c.caseSensitive,
    ignorePunctuation: c.ignorePunctuation,
  };
}

export function parseAcceptedAnswers(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function typedDraftValid(d: TypedDraft): boolean {
  return (
    d.prompt.text.trim().length > 0 &&
    parseAcceptedAnswers(d.acceptedAnswersRaw).length > 0
  );
}

export function TypedPreview({ draft }: { draft: TypedDraft }) {
  const answers = parseAcceptedAnswers(draft.acceptedAnswersRaw);
  return (
    <div className="card-surface p-4">
      <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        Prompt
      </p>
      <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
        {draft.prompt.text || <span className="text-ink-500">(empty)</span>}
      </p>
      <p className="mt-3 text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        Accepted answers
      </p>
      <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
        {answers.length === 0 ? (
          <span className="text-ink-500">(none yet)</span>
        ) : (
          answers.join(" / ")
        )}
      </p>
    </div>
  );
}
