import { useEffect, useState } from "react";

interface SessionTopBarProps {
  deckName: string;
  progress: number;
  total: number;
  startedAt: number;
  showTimer: boolean;
  // Optional short tag rendered next to the deck name. Used by Custom Study
  // sessions so the student can tell what kind of session they're in.
  modeBadge?: string;
  onExit: () => void;
}

export function SessionTopBar({
  deckName,
  progress,
  total,
  startedAt,
  showTimer,
  modeBadge,
  onExit,
}: SessionTopBarProps) {
  const elapsed = useElapsed(startedAt);
  const pct = total === 0 ? 0 : Math.min(100, Math.round((progress / total) * 100));

  return (
    <header className="sticky top-14 -mx-4 -mt-4 z-10 border-b border-ink-100 bg-cream/95 px-4 py-2 backdrop-blur dark:border-dark-surface dark:bg-dark-bg/95 sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onExit}
          aria-label="Exit study session"
          className="tap-target inline-flex items-center justify-center rounded-full text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-dark-surface"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
            <path
              d="M15 18 9 12l6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="flex-1 truncate text-center">
          <p className="flex items-center justify-center gap-2 truncate text-sm font-medium text-ink-900 dark:text-dark-ink">
            {modeBadge && (
              <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-navy dark:text-gold">
                {modeBadge}
              </span>
            )}
            <span className="truncate">{deckName}</span>
          </p>
          <p className="text-xs text-ink-500 dark:text-ink-300">
            {progress} of {total}
            {showTimer && ` · ${formatElapsed(elapsed)}`}
          </p>
        </div>
        <span aria-hidden className="w-10" />
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100 dark:bg-dark-surface">
        <div
          className="h-full bg-navy transition-[width] duration-200 dark:bg-gold"
          style={{ width: `${pct}%` }}
        />
      </div>
    </header>
  );
}

function useElapsed(startedAt: number): number {
  const [elapsed, setElapsed] = useState(() => Date.now() - startedAt);
  useEffect(() => {
    const id = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
