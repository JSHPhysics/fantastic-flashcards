import type { BasicContent, RichField } from "../../db";
import { FormField, inputClass } from "../FormField";
import { RichFieldEditor } from "../media/RichFieldEditor";
import { useEffect, useState } from "react";
import { getMedia } from "../../db";
import { objectUrlFromBlob } from "../../media/image";

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
      <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
        {field.text || <span className="text-ink-500">(empty)</span>}
      </p>
      {field.imageHash && <PreviewImage hash={field.imageHash} />}
      {field.audioHash && <PreviewAudio hash={field.audioHash} />}
    </div>
  );
}

function PreviewImage({ hash }: { hash: string }) {
  const url = useObjectUrl(hash);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="mt-3 max-h-40 rounded-lg border border-ink-100 object-contain dark:border-dark-surface"
    />
  );
}

function PreviewAudio({ hash }: { hash: string }) {
  const url = useObjectUrl(hash);
  if (!url) return null;
  return <audio controls src={url} className="mt-3 h-8 w-full" />;
}

function useObjectUrl(hash: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    setUrl(null);
    if (!hash) return;
    (async () => {
      const m = await getMedia(hash);
      if (!m || cancelled) return;
      created = objectUrlFromBlob(m.blob);
      setUrl(created);
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [hash]);
  return url;
}

export { inputClass };
