import { useRef, useState, type ClipboardEvent } from "react";
import type { RichField } from "../../db";
import { storeMedia } from "../../db";
import { compressImage } from "../../media/image";
import { ImageInput } from "./ImageInput";
import { AudioInput } from "./AudioInput";
import { SpeakerButton } from "../SpeakerButton";
import { LanguagePicker } from "../LanguagePicker";
import { AccentBar } from "../AccentBar";
import { accentsFor, labelForLanguage } from "../../tts/languages";
import { noAutoFill } from "../FormField";

interface RichFieldEditorProps {
  value: RichField;
  onChange: (next: RichField) => void;
  // Text input shape. Multiline switches to textarea.
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
  // When set, the language chip + speaker icon use this as the fallback if
  // value.language is unset. Wired via the deck's pronunciationLanguage.
  deckPronunciationLanguage?: string;
  autoFocus?: boolean;
}

// Composes text + image + audio + language for any RichField on a card.
// The language chip is informational + interactive: empty until the user
// (or deck default) sets one; tapping it opens the LanguagePicker; the
// SpeakerButton plays the current text in the effective language; the
// AccentBar surfaces language-specific accent characters that get inserted
// at the cursor without stealing focus.
//
// Native paste of an image on the text input is hijacked: a screenshot tool
// like Win+Shift+S lets a user paste straight into the field. The image goes
// through the same compressImage / storeMedia pipeline as a file upload.

export function RichFieldEditor({
  value,
  onChange,
  multiline = true,
  rows = 3,
  placeholder,
  id,
  deckPronunciationLanguage,
  autoFocus,
}: RichFieldEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const setText = (text: string) => onChange({ ...value, text });
  const setImage = (hash: string | undefined) =>
    onChange({ ...value, imageHash: hash });
  const setAudio = (hash: string | undefined) =>
    onChange({ ...value, audioHash: hash });
  const setLanguage = (lang: string | undefined) =>
    onChange({ ...value, language: lang });

  const effectiveLang = value.language ?? deckPronunciationLanguage;
  const accents = accentsFor(effectiveLang);

  // Inserts `char` at the current cursor position without losing focus. The
  // caller (AccentBar) prevents the default focus shift onMouseDown, so
  // selectionStart / selectionEnd remain valid when this runs.
  const insertAtCursor = (char: string) => {
    const el = inputRef.current;
    if (!el) {
      setText(value.text + char);
      return;
    }
    const start = el.selectionStart ?? value.text.length;
    const end = el.selectionEnd ?? value.text.length;
    const next = value.text.slice(0, start) + char + value.text.slice(end);
    setText(next);
    // Restore cursor after React rerender so subsequent inserts chain cleanly.
    requestAnimationFrame(() => {
      const newPos = start + char.length;
      el.focus();
      el.setSelectionRange(newPos, newPos);
    });
  };

  // Native paste handler that grabs an image off the clipboard before the
  // browser's default text-paste runs. Plays nicely with text paste: if no
  // image is present, we don't preventDefault.
  const handlePaste = async (
    e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        setPasteError(null);
        try {
          const compressed = await compressImage(file);
          await storeMedia({
            hash: compressed.hash,
            blob: compressed.blob,
            mimeType: compressed.mimeType,
            bytes: compressed.bytes,
          });
          setImage(compressed.hash);
        } catch (err) {
          setPasteError(
            err instanceof Error ? err.message : "Image paste failed",
          );
        }
        return;
      }
    }
  };

  const commonInputClass =
    "w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink";

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          id={id}
          value={value.text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`${commonInputClass} resize-y`}
          {...noAutoFill}
        />
      ) : (
        <input
          ref={(el) => {
            inputRef.current = el;
          }}
          id={id}
          value={value.text}
          onChange={(e) => setText(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={commonInputClass}
          {...noAutoFill}
        />
      )}

      {accents.length > 0 && (
        <AccentBar chars={accents} onInsert={insertAtCursor} />
      )}

      {pasteError && (
        <p role="alert" className="text-xs text-again">
          {pasteError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ImageInput imageHash={value.imageHash} onChange={setImage} />
        <AudioInput audioHash={value.audioHash} onChange={setAudio} />
        <LanguageChip
          fieldLanguage={value.language}
          deckDefault={deckPronunciationLanguage}
          onClick={() => setPickerOpen(true)}
        />
        <SpeakerButton text={value.text} lang={effectiveLang} />
      </div>

      <LanguagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={value.language}
        deckDefault={deckPronunciationLanguage}
        onChange={setLanguage}
      />
    </div>
  );
}

function LanguageChip({
  fieldLanguage,
  deckDefault,
  onClick,
}: {
  fieldLanguage: string | undefined;
  deckDefault: string | undefined;
  onClick: () => void;
}) {
  const showingDeckDefault = !fieldLanguage && deckDefault;
  const showingNone = !fieldLanguage && !deckDefault;
  const showingOverride = Boolean(fieldLanguage);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Choose pronunciation language"
      className="tap-target inline-flex items-center gap-1.5 rounded-full border border-ink-300 bg-surface px-3 text-xs font-medium text-ink-700 hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-bg dark:text-ink-300"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
      {showingNone && <span>Add language</span>}
      {showingDeckDefault && (
        <span className="text-ink-500 dark:text-ink-300">
          {labelForLanguage(deckDefault!)} (deck)
        </span>
      )}
      {showingOverride && (
        <span className="text-navy dark:text-gold">
          {labelForLanguage(fieldLanguage!)}
        </span>
      )}
    </button>
  );
}
