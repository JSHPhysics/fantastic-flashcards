import type { McqContent, McqOption, RichField } from "../../db";
import { FormField, inputClass } from "../FormField";
import { newId } from "../../db/ids";
import { RichFieldEditor } from "../media/RichFieldEditor";

export interface McqDraft {
  question: RichField;
  options: McqOption[];
  shuffleOptions: boolean;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

interface Props {
  draft: McqDraft;
  onChange: (next: McqDraft) => void;
}

export function McqForm({ draft, onChange }: Props) {
  const setOption = (id: string, patch: Partial<McqOption>) => {
    onChange({
      ...draft,
      options: draft.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };
  const removeOption = (id: string) => {
    if (draft.options.length <= MIN_OPTIONS) return;
    onChange({
      ...draft,
      options: draft.options.filter((o) => o.id !== id),
    });
  };
  const addOption = () => {
    if (draft.options.length >= MAX_OPTIONS) return;
    onChange({
      ...draft,
      options: [...draft.options, { id: newId(), text: "", correct: false }],
    });
  };
  const moveOption = (id: string, direction: -1 | 1) => {
    const idx = draft.options.findIndex((o) => o.id === id);
    const swap = idx + direction;
    if (idx < 0 || swap < 0 || swap >= draft.options.length) return;
    const next = [...draft.options];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange({ ...draft, options: next });
  };

  return (
    <div className="space-y-4">
      <FormField label="Question" htmlFor="mcq-question">
        <RichFieldEditor
          id="mcq-question"
          value={draft.question}
          onChange={(question) => onChange({ ...draft, question })}
          rows={2}
          autoFocus
        />
      </FormField>

      <FormField
        label="Options"
        hint={`Pick at least one correct. ${MIN_OPTIONS} to ${MAX_OPTIONS} options.`}
      >
        <ul className="space-y-2">
          {draft.options.map((opt, idx) => (
            <li
              key={opt.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface p-2 dark:border-dark-surface dark:bg-dark-bg"
            >
              <label className="tap-target flex items-center pl-2">
                <input
                  type="checkbox"
                  checked={opt.correct}
                  aria-label="Correct answer"
                  onChange={(e) =>
                    setOption(opt.id, { correct: e.target.checked })
                  }
                  className="h-4 w-4 accent-good"
                />
              </label>
              <input
                value={opt.text}
                onChange={(e) => setOption(opt.id, { text: e.target.value })}
                placeholder={`Option ${idx + 1}`}
                className={`${inputClass} flex-1`}
              />
              <div className="flex items-center">
                <IconButton
                  label="Move up"
                  disabled={idx === 0}
                  onClick={() => moveOption(opt.id, -1)}
                >
                  <Chevron up />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={idx === draft.options.length - 1}
                  onClick={() => moveOption(opt.id, 1)}
                >
                  <Chevron />
                </IconButton>
                <IconButton
                  label="Remove option"
                  disabled={draft.options.length <= MIN_OPTIONS}
                  onClick={() => removeOption(opt.id)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden
                  >
                    <path
                      d="M6 6l12 12M18 6 6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addOption}
          disabled={draft.options.length >= MAX_OPTIONS}
          className="mt-3 tap-target inline-flex items-center gap-2 rounded-xl border border-ink-300 bg-surface px-4 text-sm font-semibold text-navy hover:bg-ink-100 disabled:opacity-50 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
        >
          + Add option
        </button>
      </FormField>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={draft.shuffleOptions}
          onChange={(e) =>
            onChange({ ...draft, shuffleOptions: e.target.checked })
          }
          className="mt-1 h-4 w-4 accent-navy"
        />
        <span className="text-sm text-ink-900 dark:text-dark-ink">
          Shuffle option order at review time
        </span>
      </label>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="tap-target inline-flex items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-dark-surface dark:hover:text-dark-ink"
    >
      {children}
    </button>
  );
}

function Chevron({ up }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${up ? "" : "rotate-180"}`}
      aria-hidden
    >
      <path
        d="M6 15l6-6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function defaultMcqDraft(): McqDraft {
  return {
    question: { text: "" },
    options: [
      { id: newId(), text: "", correct: false },
      { id: newId(), text: "", correct: false },
    ],
    shuffleOptions: true,
  };
}

export function mcqDraftFromContent(c: McqContent): McqDraft {
  return {
    question: { ...c.question },
    options: c.options.map((o) => ({ ...o })),
    shuffleOptions: c.shuffleOptions,
  };
}

export function mcqDraftValid(d: McqDraft): boolean {
  if (d.question.text.trim().length === 0) return false;
  if (d.options.length < MIN_OPTIONS) return false;
  if (d.options.some((o) => o.text.trim().length === 0)) return false;
  if (!d.options.some((o) => o.correct)) return false;
  return true;
}

export function McqPreview({ draft }: { draft: McqDraft }) {
  return (
    <div className="space-y-3">
      <div className="card-surface p-4">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Question
        </p>
        <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
          {draft.question.text || (
            <span className="text-ink-500">(empty)</span>
          )}
        </p>
        <ul className="mt-3 space-y-1">
          {draft.options.map((o, idx) => (
            <li
              key={o.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                o.correct
                  ? "bg-good/10 text-good"
                  : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
              }`}
            >
              {String.fromCharCode(65 + idx)}. {o.text || "(empty)"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
