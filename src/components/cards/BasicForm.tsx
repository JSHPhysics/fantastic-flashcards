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
  // Defaults for each side's RichFieldEditor language chip. front uses the
  // primary, back uses the secondary (translation) language if set, otherwise
  // also the primary. Per-field overrides still win.
  deckPronunciationLanguage?: string;
  deckSecondaryLanguage?: string;
}

export function BasicForm({
  draft,
  onChange,
  lockAutoReverseOff,
  deckPronunciationLanguage,
  deckSecondaryLanguage,
}: Props) {
  const swapSides = () => {
    onChange({ ...draft, front: draft.back, back: draft.front });
  };
  const backDefault = deckSecondaryLanguage ?? deckPronunciationLanguage;
  // Surface the swap button only when the deck is bilingual; for monolingual
  // decks swap is rarely useful and would clutter the form.
  const showSwap =
    deckSecondaryLanguage !== undefined &&
    deckPronunciationLanguage !== undefined;

  return (
    <div className="space-y-4">
      <FormField label="Front" htmlFor="basic-front">
        <RichFieldEditor
          id="basic-front"
          value={draft.front}
          onChange={(front) => onChange({ ...draft, front })}
          deckPronunciationLanguage={deckPronunciationLanguage}
          autoFocus
        />
      </FormField>
      {showSwap && (
        <div className="-my-1 flex justify-center">
          <button
            type="button"
            onClick={swapSides}
            className="tap-target inline-flex items-center gap-2 rounded-full px-3 text-xs font-medium text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-surface"
            title="Swap front and back (keeps per-field languages)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
              aria-hidden
            >
              <path
                d="M7 7h11l-3-3M17 17H6l3 3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Swap sides
          </button>
        </div>
      )}
      <FormField label="Back" htmlFor="basic-back">
        <RichFieldEditor
          id="basic-back"
          value={draft.back}
          onChange={(back) => onChange({ ...draft, back })}
          deckPronunciationLanguage={backDefault}
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
