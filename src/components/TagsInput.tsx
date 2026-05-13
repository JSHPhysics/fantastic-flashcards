import { useEffect, useMemo, useRef, useState } from "react";
import { listAllTags } from "../db";

// Tag pill input with autocomplete from cards.tags multi-entry index.
// Tags are normalised to lowercase + trimmed on the way in; render order
// follows insertion order. Comma, Enter, or Tab commits the current draft.

interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function TagsInput({ value, onChange }: TagsInputProps) {
  const [draft, setDraft] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllTags().then((tags) => {
      if (!cancelled) setAllTags(tags);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter((t) => t.includes(q) && !value.includes(t))
      .slice(0, 6);
  }, [draft, allTags, value]);

  const commit = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };

  const remove = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div
      className="rounded-xl border border-ink-300 bg-surface px-2 py-1.5 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy dark:bg-gold/15 dark:text-gold"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                remove(tag);
              }}
              className="rounded-full text-current/70 hover:text-current"
            >
              <svg
                viewBox="0 0 20 20"
                className="h-3.5 w-3.5"
                fill="none"
                aria-hidden
              >
                <path
                  d="M5 5l10 10M15 5 5 15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            commit(draft);
            // Delay blur-close so suggestion clicks register first
            setTimeout(() => setFocused(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={value.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[6rem] bg-transparent px-1 py-1 text-sm text-ink-900 placeholder:text-ink-500 focus:outline-none dark:text-dark-ink"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div className="relative">
          <ul className="absolute left-0 right-0 top-1 z-20 max-h-48 overflow-y-auto rounded-xl border border-ink-100 bg-surface py-1 shadow-lg dark:border-dark-surface dark:bg-dark-surface">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(s);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-ink-100 dark:hover:bg-dark-bg"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
