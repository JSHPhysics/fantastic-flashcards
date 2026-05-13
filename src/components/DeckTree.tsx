import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collectDescendantIds,
  countDueCards,
  useDecks,
  type Deck,
} from "../db";
import { buildDeckTree, type DeckNode } from "../decks/tree";
import { DeckSizeChip } from "./DeckSizeChip";
import { DueTodayBadge } from "./DueTodayBadge";
import { DeckActionsMenu } from "./DeckActionsMenu";
import { StreakChip } from "./StreakChip";
import {
  formatRelativeTime,
  useDeckPracticeStatsMap,
  type DeckPracticeStats,
} from "../study/practiceStats";

// localStorage key for which deck nodes are *collapsed*. We track collapses
// rather than expansions so that newly-created decks default to expanded —
// the more common preference, and the original v1 behaviour.
const COLLAPSED_KEY = "ff_collapsed_decks";

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const ids = JSON.parse(raw);
    if (!Array.isArray(ids)) return new Set();
    return new Set(ids.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistCollapsed(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    // Private mode may refuse writes; silently fall back to session-only.
  }
}

export function DeckTree() {
  const decks = useDecks();
  const statsMap = useDeckPracticeStatsMap();
  const tree = useMemo(() => (decks ? buildDeckTree(decks) : []), [decks]);

  // Lazy initialiser so we only read localStorage once on mount.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistCollapsed(next);
      return next;
    });
  }, []);

  if (!decks) {
    return <p className="text-sm text-ink-500">Loading...</p>;
  }
  if (decks.length === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-base font-medium text-ink-900 dark:text-dark-ink">
          No decks yet
        </p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
          Tap the + button to create your first deck, or{" "}
          <Link
            to="/import/quizlet"
            className="text-navy underline dark:text-gold"
          >
            import a set from Quizlet
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <ul role="tree" className="card-surface divide-y divide-ink-100 dark:divide-dark-bg">
      {tree.map((node) => (
        <DeckTreeBranch
          key={node.deck.id}
          node={node}
          statsMap={statsMap}
          collapsed={collapsed}
          onToggle={toggle}
        />
      ))}
    </ul>
  );
}

function DeckTreeBranch({
  node,
  statsMap,
  collapsed,
  onToggle,
}: {
  node: DeckNode;
  statsMap: Map<string, DeckPracticeStats>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const expanded = !collapsed.has(node.deck.id);
  const hasChildren = node.children.length > 0;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <DeckRow
        deck={node.deck}
        depth={node.depth}
        expandable={hasChildren}
        expanded={expanded}
        onToggle={() => onToggle(node.deck.id)}
        stats={statsMap.get(node.deck.id)}
      />
      {hasChildren && expanded && (
        <ul role="group" className="divide-y divide-ink-100 dark:divide-dark-bg">
          {node.children.map((c) => (
            <DeckTreeBranch
              key={c.deck.id}
              node={c}
              statsMap={statsMap}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function DeckRow({
  deck,
  depth,
  expandable,
  expanded,
  onToggle,
  stats,
}: {
  deck: Deck;
  depth: number;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  stats: DeckPracticeStats | undefined;
}) {
  const [dueCount, setDueCount] = useState(0);

  // Refetch due count when card counts shift. descendantCardCount is the cheapest
  // signal that something changed in this subtree.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = await collectDescendantIds(deck.id);
      const count = await countDueCards(ids);
      if (!cancelled) setDueCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [deck.id, deck.descendantCardCount, deck.cardCount]);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      style={{ paddingLeft: `${0.75 + (depth - 1) * 1.25}rem` }}
    >
      {expandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="tap-target -ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-surface"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            aria-hidden
          >
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <span aria-hidden className="inline-block w-9" />
      )}

      <span
        aria-hidden
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: deck.colour }}
      />

      <Link
        to={`/decks/${deck.id}`}
        className="flex flex-1 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md py-1 text-left text-base text-ink-900 hover:underline dark:text-dark-ink"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{deck.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500 dark:text-ink-300">
            {deck.subject && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] dark:bg-dark-surface">
                {deck.subject}
              </span>
            )}
            <span>{deck.cardCount} cards</span>
            {deck.descendantCardCount > deck.cardCount && (
              <span className="hidden sm:inline">
                ({deck.descendantCardCount} incl. sub-decks)
              </span>
            )}
            {stats && stats.lastReviewedAt > 0 && (
              <span className="hidden sm:inline">
                Last studied {formatRelativeTime(stats.lastReviewedAt).toLowerCase()}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {stats && <StreakChip days={stats.streakDays} />}
          {/* Media-size chip is least important on narrow screens; hide it
              below sm so the streak + due-today badge stay readable. */}
          <span className="hidden sm:inline-flex">
            <DeckSizeChip bytes={deck.mediaBytes} />
          </span>
          <DueTodayBadge count={dueCount} />
        </span>
      </Link>

      <DeckActionsMenu deck={deck} />
    </div>
  );
}
