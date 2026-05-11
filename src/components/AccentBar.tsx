// Inline strip of language-specific characters. Renders below a text field
// when an effective pronunciation language has accents defined for it. Each
// button inserts its character at the input's cursor without stealing focus,
// so a fast typist keeps their place.
//
// onMouseDown prevents the default focus shift; the host input keeps focus
// across the tap. The host is responsible for performing the insertion using
// the textarea's current selectionStart/End.

interface AccentBarProps {
  chars: string[];
  onInsert: (char: string) => void;
}

export function AccentBar({ chars, onInsert }: AccentBarProps) {
  if (chars.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Language-specific characters"
      className="flex max-w-full flex-wrap gap-1 rounded-xl border border-ink-100 bg-surface/60 p-1.5 dark:border-dark-surface dark:bg-dark-bg/60"
    >
      {chars.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Insert ${c}`}
          onMouseDown={(e) => {
            // Keep the textarea focused so the cursor doesn't jump.
            e.preventDefault();
          }}
          onClick={() => onInsert(c)}
          className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-base font-medium text-ink-900 transition-colors hover:bg-ink-100 dark:text-dark-ink dark:hover:bg-dark-surface"
        >
          {c}
        </button>
      ))}
    </div>
  );
}
