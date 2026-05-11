import type { RichField } from "../../db";
import { useObjectUrl } from "../../media/useObjectUrl";

// Renders text + image thumbnail + audio control for a RichField, with a
// consistent fallback when the field is empty. Used by the editor's preview
// pane across every card type.
export function RichFieldRender({
  field,
  emptyText = "(empty)",
}: {
  field: RichField;
  emptyText?: string;
}) {
  return (
    <>
      <p className="mt-1 whitespace-pre-wrap text-base text-ink-900 dark:text-dark-ink">
        {field.text || <span className="text-ink-500">{emptyText}</span>}
      </p>
      {field.imageHash && <PreviewImage hash={field.imageHash} />}
      {field.audioHash && <PreviewAudio hash={field.audioHash} />}
    </>
  );
}

export function PreviewImage({ hash }: { hash: string }) {
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

export function PreviewAudio({ hash }: { hash: string }) {
  const url = useObjectUrl(hash);
  if (!url) return null;
  return <audio controls src={url} className="mt-3 h-8 w-full" />;
}
