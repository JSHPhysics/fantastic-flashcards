import type { BasicContent, RichField } from "../../db";
import { FormField, inputClass, textareaClass } from "../FormField";

export interface BasicDraft {
  front: RichField;
  back: RichField;
  autoReverse: boolean;
}

interface Props {
  draft: BasicDraft;
  onChange: (next: BasicDraft) => void;
  // If true, autoReverse can't be turned off because we don't want to silently
  // strand siblings (e.g. when editing the reverse, which has its own card row).
  // Owned by CardEditor.
  lockAutoReverseOff?: boolean;
}

export function BasicForm({ draft, onChange, lockAutoReverseOff }: Props) {
  const setFront = (text: string) =>
    onChange({ ...draft, front: { ...draft.front, text } });
  const setBack = (text: string) =>
    onChange({ ...draft, back: { ...draft.back, text } });

  return (
    <div className="space-y-4">
      <FormField label="Front" htmlFor="basic-front">
        <textarea
          id="basic-front"
          value={draft.front.text}
          onChange={(e) => setFront(e.target.value)}
          rows={3}
          className={textareaClass}
          autoFocus
        />
      </FormField>
      <FormField label="Back" htmlFor="basic-back">
        <textarea
          id="basic-back"
          value={draft.back.text}
          onChange={(e) => setBack(e.target.value)}
          rows={3}
          className={textareaClass}
        />
      </FormField>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={draft.autoReverse}
          disabled={lockAutoReverseOff}
          onChange={(e) =>
            onChange({ ...draft, autoReverse: e.target.checked })
          }
          className="mt-1 h-4 w-4 accent-navy"
        />
        <span className="text-sm text-ink-900 dark:text-dark-ink">
          Also create the reverse card
          <span className="block text-xs text-ink-500 dark:text-ink-300">
            Generates a sibling card with front and back swapped. Edits to this
            card propagate; delete cascades.
          </span>
        </span>
      </label>
    </div>
  );
}

export function defaultBasicDraft(): BasicDraft {
  return {
    front: { text: "" },
    back: { text: "" },
    autoReverse: false,
  };
}

export function basicDraftFromContent(c: BasicContent): BasicDraft {
  return { front: c.front, back: c.back, autoReverse: c.autoReverse };
}

export function basicDraftValid(d: BasicDraft): boolean {
  return d.front.text.trim().length > 0 && d.back.text.trim().length > 0;
}

export function BasicPreview({ draft }: { draft: BasicDraft }) {
  return (
    <div className="space-y-3">
      <PreviewFace label="Front" text={draft.front.text} />
      <PreviewFace label="Back" text={draft.back.text} />
    </div>
  );
}

function PreviewFace({ label, text }: { label: string; text: string }) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
        {text || <span className="text-ink-500">(empty)</span>}
      </p>
    </div>
  );
}

export { inputClass };
