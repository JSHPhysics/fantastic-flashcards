import type { RichField } from "../../db";
import { ImageInput } from "./ImageInput";
import { AudioInput } from "./AudioInput";

interface RichFieldEditorProps {
  value: RichField;
  onChange: (next: RichField) => void;
  // Text input shape. Multiline switches to textarea.
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
  // Show the language selector? Wired up in Session 7.
  showLanguage?: boolean;
  autoFocus?: boolean;
}

// Composes text + image + audio for any RichField on a card. The same
// component is used by Basic / MCQ / Typed / etc. forms so the per-field
// affordances stay consistent across card types.

export function RichFieldEditor({
  value,
  onChange,
  multiline = true,
  rows = 3,
  placeholder,
  id,
  autoFocus,
}: RichFieldEditorProps) {
  const setText = (text: string) => onChange({ ...value, text });
  const setImage = (hash: string | undefined) =>
    onChange({ ...value, imageHash: hash });
  const setAudio = (hash: string | undefined) =>
    onChange({ ...value, audioHash: hash });

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          id={id}
          value={value.text}
          onChange={(e) => setText(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full resize-y rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
        />
      ) : (
        <input
          id={id}
          value={value.text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <ImageInput imageHash={value.imageHash} onChange={setImage} />
        <AudioInput audioHash={value.audioHash} onChange={setAudio} />
      </div>
    </div>
  );
}
