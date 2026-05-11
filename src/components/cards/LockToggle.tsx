// Lock / unlock toggle. Used inline next to the deck selector, type tabs,
// and tags input to freeze a field across consecutive save-and-add-another
// commits during bulk authoring.

interface LockToggleProps {
  locked: boolean;
  onChange: (next: boolean) => void;
  fieldLabel: string;
  size?: "sm" | "md";
}

export function LockToggle({
  locked,
  onChange,
  fieldLabel,
  size = "sm",
}: LockToggleProps) {
  const sizeClass = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <button
      type="button"
      aria-pressed={locked}
      aria-label={`${locked ? "Unlock" : "Lock"} ${fieldLabel} between cards`}
      title={
        locked
          ? `${fieldLabel} locked across Save and add another`
          : `Lock ${fieldLabel} across Save and add another`
      }
      onClick={() => onChange(!locked)}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full transition-colors ${
        locked
          ? "bg-gold/20 text-navy hover:bg-gold/30 dark:text-gold"
          : "text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-dark-surface dark:hover:text-dark-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        {locked ? (
          <>
            <rect
              x="5"
              y="11"
              width="14"
              height="9"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 11V8a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <rect
              x="5"
              y="11"
              width="14"
              height="9"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 11V8a4 4 0 0 1 7-2.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}
