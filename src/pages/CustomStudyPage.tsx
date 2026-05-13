import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  listAllTags,
  useDecks,
  type CardType,
  type CustomStudyConfig,
} from "../db";
import { Button } from "../components/Button";
import { FormField } from "../components/FormField";
import { loadLastCustomStudyConfig } from "../study/customStudyBuilder";
import { buildDeckTree, flattenTree, type DeckNode } from "../decks/tree";

const CARD_TYPE_OPTIONS: { id: CardType; label: string }[] = [
  { id: "basic", label: "Basic" },
  { id: "cloze", label: "Cloze" },
  { id: "mcq", label: "MCQ" },
  { id: "typed", label: "Typed" },
  { id: "occlusion", label: "Occlusion" },
  { id: "drawing", label: "Drawing" },
];

export function CustomStudyPage() {
  const navigate = useNavigate();
  const decks = useDecks();
  const [params] = useSearchParams();

  // Pre-select a deck if launched from /study/custom?deck=X.
  const presetDeck = params.get("deck") ?? undefined;

  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(
    presetDeck ? [presetDeck] : [],
  );
  const [includeSubDecks, setIncludeSubDecks] = useState(true);

  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"any" | "all">("any");

  const [typeFilter, setTypeFilter] = useState<Set<CardType>>(
    new Set(CARD_TYPE_OPTIONS.map((o) => o.id)),
  );

  const [recentMistakesOn, setRecentMistakesOn] = useState(false);
  const [recentMistakesDays, setRecentMistakesDays] = useState(7);

  const [maxCards, setMaxCards] = useState(20);
  const [shuffle, setShuffle] = useState(true);
  // Practice is practice — by default a custom session should still move
  // the FSRS schedule along. The toggle is still there for the "I just
  // want to drill these cards without messing up my schedule" case.
  const [updateSpacedRepetition, setUpdateSpacedRepetition] = useState(true);

  const [lastConfig, setLastConfig] = useState<CustomStudyConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAllTags().then((tags) => {
      if (!cancelled) setAllTags(tags);
    });
    loadLastCustomStudyConfig().then((c) => {
      if (!cancelled) setLastConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const deckNodes = useMemo<DeckNode[]>(
    () => (decks ? flattenTree(buildDeckTree(decks)) : []),
    [decks],
  );

  const restoreLast = () => {
    if (!lastConfig) return;
    setSelectedDeckIds(lastConfig.deckIds);
    setIncludeSubDecks(lastConfig.includeSubDecks);
    setSelectedTags(lastConfig.tagFilter?.tags ?? []);
    setTagMode(lastConfig.tagFilter?.mode ?? "any");
    setTypeFilter(
      new Set(
        lastConfig.cardTypeFilter && lastConfig.cardTypeFilter.length > 0
          ? lastConfig.cardTypeFilter
          : CARD_TYPE_OPTIONS.map((o) => o.id),
      ),
    );
    if (lastConfig.recentMistakes) {
      setRecentMistakesOn(true);
      setRecentMistakesDays(lastConfig.recentMistakes.withinDays);
    } else {
      setRecentMistakesOn(false);
    }
    setMaxCards(lastConfig.maxCards);
    setShuffle(lastConfig.shuffle);
  };

  const toggleDeck = (deckId: string, on: boolean) => {
    setSelectedDeckIds((prev) =>
      on ? [...new Set([...prev, deckId])] : prev.filter((id) => id !== deckId),
    );
  };

  const toggleType = (type: CardType, on: boolean) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (on) next.add(type);
      else next.delete(type);
      return next;
    });
  };

  const toggleTag = (tag: string, on: boolean) => {
    setSelectedTags((prev) =>
      on ? [...new Set([...prev, tag])] : prev.filter((t) => t !== tag),
    );
  };

  const canStart =
    selectedDeckIds.length > 0 && typeFilter.size > 0 && maxCards > 0;

  const start = () => {
    if (!canStart) return;
    const config: CustomStudyConfig = {
      deckIds: selectedDeckIds,
      includeSubDecks,
      tagFilter:
        selectedTags.length > 0
          ? { tags: selectedTags, mode: tagMode }
          : undefined,
      cardTypeFilter:
        typeFilter.size === CARD_TYPE_OPTIONS.length
          ? undefined
          : [...typeFilter],
      recentMistakes: recentMistakesOn
        ? { withinDays: recentMistakesDays }
        : undefined,
      maxCards,
      shuffle,
    };
    navigate("/study", {
      state: { customConfig: config, updateSpacedRepetition },
    });
  };

  return (
    <section className="space-y-6">
      <header>
        <Link
          to="/"
          className="text-sm text-ink-500 hover:underline dark:text-ink-300"
        >
          ← Home
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy dark:text-gold sm:text-3xl">
          Custom study
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          Pick exactly which cards to drill. By default this won't change the
          spaced-repetition schedule, so it's safe practice.
        </p>
        {lastConfig && (
          <button
            type="button"
            onClick={restoreLast}
            className="mt-2 text-sm text-navy underline dark:text-gold"
          >
            Repeat last custom study
          </button>
        )}
      </header>

      <FormField label="Decks">
        <DeckPicker
          deckNodes={deckNodes}
          selectedIds={selectedDeckIds}
          onToggle={toggleDeck}
        />
        <label className="mt-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeSubDecks}
            onChange={(e) => setIncludeSubDecks(e.target.checked)}
            className="h-4 w-4 accent-navy"
          />
          <span className="text-sm text-ink-700 dark:text-ink-300">
            Include cards from sub-decks
          </span>
        </label>
      </FormField>

      {allTags.length > 0 && (
        <FormField label="Tags (optional)">
          <div className="flex flex-wrap gap-2">
            {allTags.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag, !active)}
                  className={`tap-target inline-flex items-center rounded-full px-3 text-xs font-medium transition-colors ${
                    active
                      ? "bg-navy text-cream"
                      : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
            <div className="mt-2 flex items-center gap-3 text-sm text-ink-700 dark:text-ink-300">
              <span>Match:</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="tag-mode"
                  checked={tagMode === "any"}
                  onChange={() => setTagMode("any")}
                  className="h-4 w-4 accent-navy"
                />
                any
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="tag-mode"
                  checked={tagMode === "all"}
                  onChange={() => setTagMode("all")}
                  className="h-4 w-4 accent-navy"
                />
                all
              </label>
            </div>
          )}
        </FormField>
      )}

      <FormField label="Card types">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CARD_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-2 dark:border-dark-surface dark:bg-dark-bg"
            >
              <input
                type="checkbox"
                checked={typeFilter.has(opt.id)}
                onChange={(e) => toggleType(opt.id, e.target.checked)}
                className="h-4 w-4 accent-navy"
              />
              <span className="text-sm text-ink-900 dark:text-dark-ink">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </FormField>

      <FormField label="Recent mistakes (optional)">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={recentMistakesOn}
            onChange={(e) => setRecentMistakesOn(e.target.checked)}
            className="mt-1 h-4 w-4 accent-navy"
          />
          <span className="text-sm">
            <span className="block text-ink-900 dark:text-dark-ink">
              Only include cards I rated Again or Hard recently
            </span>
            <span className="mt-1 inline-flex items-center gap-2 text-xs text-ink-500 dark:text-ink-300">
              within the last
              <input
                type="number"
                min={1}
                max={365}
                value={recentMistakesDays}
                onChange={(e) =>
                  setRecentMistakesDays(
                    Math.max(1, Math.min(365, Number(e.target.value) || 1)),
                  )
                }
                disabled={!recentMistakesOn}
                className="w-16 rounded-lg border border-ink-300 bg-surface px-2 py-1 text-sm text-ink-900 disabled:opacity-50 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
              />
              days
            </span>
          </span>
        </label>
      </FormField>

      <FormField label="How many cards">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={maxCards}
            onChange={(e) => setMaxCards(Number(e.target.value))}
            className="flex-1"
          />
          <span className="w-12 text-right text-sm font-medium text-ink-900 dark:text-dark-ink">
            {maxCards}
          </span>
        </div>
      </FormField>

      <FormField label="Behaviour">
        <div className="space-y-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={shuffle}
              onChange={(e) => setShuffle(e.target.checked)}
              className="mt-1 h-4 w-4 accent-navy"
            />
            <span className="text-sm text-ink-900 dark:text-dark-ink">
              Shuffle the order
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={updateSpacedRepetition}
              onChange={(e) => setUpdateSpacedRepetition(e.target.checked)}
              className="mt-1 h-4 w-4 accent-navy"
            />
            <span className="text-sm">
              <span className="block text-ink-900 dark:text-dark-ink">
                Let this session update the spaced-repetition schedule
              </span>
              <span className="block text-xs text-ink-500 dark:text-ink-300">
                Off by default. When off, ratings are recorded but the cards'
                review dates stay where they were.
              </span>
            </span>
          </label>
        </div>
      </FormField>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={start} disabled={!canStart}>
          Start
        </Button>
        <Button variant="ghost" onClick={() => navigate(-1)}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function DeckPicker({
  deckNodes,
  selectedIds,
  onToggle,
}: {
  deckNodes: DeckNode[];
  selectedIds: string[];
  onToggle: (deckId: string, on: boolean) => void;
}) {
  if (deckNodes.length === 0) {
    return (
      <p className="text-sm text-ink-500 dark:text-ink-300">
        You haven't created any decks yet.
      </p>
    );
  }
  return (
    <ul className="rounded-xl border border-ink-100 bg-surface dark:border-dark-surface dark:bg-dark-bg">
      {deckNodes.map((node) => (
        <li key={node.deck.id}>
          <label
            className="tap-target flex cursor-pointer items-center gap-3 border-b border-ink-100 px-3 py-2 last:border-b-0 dark:border-dark-surface"
            style={{ paddingLeft: `${0.75 + (node.depth - 1) * 1.25}rem` }}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(node.deck.id)}
              onChange={(e) => onToggle(node.deck.id, e.target.checked)}
              className="h-4 w-4 accent-navy"
            />
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: node.deck.colour }}
            />
            <span className="text-sm text-ink-900 dark:text-dark-ink">
              {node.deck.name}
            </span>
            <span className="ml-auto text-xs text-ink-500 dark:text-ink-300">
              {node.deck.cardCount} cards
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
