import type { BasicContent, RichField } from "../../db";
import { FormField } from "../FormField";
import { RichFieldEditor } from "../media/RichFieldEditor";
import { RichFieldRender } from "../media/RichFieldPreview";

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
  return (
    <div className="space-y-4">
      <FormField label="Front" htmlFor="basic-front">
        <RichFieldEditor
          id="basic-front"
          value={draft.front}
          onChange={(front) => onChange({ ...draft, front })}
          autoFocus
        />
      </FormField>
      <FormField label="Back" htmlFor="basic-back">
        <RichFieldEditor
          id="basic-back"
          value={draft.back}
          onChange={(back) => onChange({ ...draft, back })}
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
      <PreviewFace label="Front" field={draft.front} />
      <PreviewFace label="Back" field={draft.back} />
    </div>
  );
}

function PreviewFace({ label, field }: { label: string; field: RichField }) {
  return (
    <div className="card-surface p-4">
      <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </p>
      <RichFieldRender field={field} />
    </div>
  );
}
