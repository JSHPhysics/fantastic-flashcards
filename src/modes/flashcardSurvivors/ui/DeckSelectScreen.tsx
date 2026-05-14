// Mode-specific deck-select for Flashcard Survivors (Survivors-Spec §2.12).
//
// - Top banner: "recommended basic cards" notice (dismissible per session).
// - Deck rows with a "% basic" badge; <50% basic gets a soft warning chip.
// - Difficulty pills (Insane disabled until Forgotten Mastery is unlocked).
// - Input mode pills (Tap disabled if combined basic count < 4).

import { useEffect, useMemo, useState } from "react";
import { useDecks, type Deck, type SurvivorDifficulty, type SurvivorInputMode } from "../../../db";
import { db } from "../../../db/schema";
import { useMastery } from "../persistence/survivorStore";
import { Button } from "../../../components/Button";
import { HowToPlayModal } from "./HowToPlayModal";

interface DeckSelectScreenProps {
  onStart: (cfg: {
    deckIds: string[];
    difficulty: SurvivorDifficulty;
    inputMode: SurvivorInputMode;
  }) => void;
  onOpenMastery: () => void;
  onClose: () => void;
}

const NOTICE_KEY = "ff_survivors_notice_dismissed_session";

export function DeckSelectScreen({ onStart, onOpenMastery, onClose }: DeckSelectScreenProps) {
  const decks = useDecks();
  const mastery = useMastery();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<SurvivorDifficulty>("normal");
  const [inputMode, setInputMode] = useState<SurvivorInputMode>("keyboard");
  const [basicByDeck, setBasicByDeck] = useState<Record<string, { basic: number; total: number }>>({});
  const [noticeDismissed, setNoticeDismissed] = useState<boolean>(
    () => sessionStorage.getItem(NOTICE_KEY) === "1",
  );
  // Locally-owned how-to-play modal. The same component is used by the
  // session as the first-run gate; here it's just a casual re-read, so
  // we pass isPreRun=false and treat onStart and onClose identically.
  const [helpOpen, setHelpOpen] = useState(false);

  // Count basic cards per deck for the "% basic" badge.
  useEffect(() => {
    if (!decks) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, { basic: number; total: number }> = {};
      for (const d of decks) {
        const cards = await db.cards.where("deckId").equals(d.id).toArray();
        const basic = cards.filter((c) => c.type === "basic" && !c.suspended).length;
        map[d.id] = { basic, total: cards.length };
      }
      if (!cancelled) setBasicByDeck(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [decks]);

  const selectedBasicCount = useMemo(() => {
    let total = 0;
    for (const id of selected) total += basicByDeck[id]?.basic ?? 0;
    return total;
  }, [selected, basicByDeck]);

  const tapEligible = selectedBasicCount >= 4;
  // If Tap is selected but no longer eligible, fall back to Keyboard.
  useEffect(() => {
    if (inputMode === "tap" && !tapEligible) setInputMode("keyboard");
  }, [tapEligible, inputMode]);

  const insanityUnlocked = (mastery?.unlockedNodes ?? []).includes("forgotten-mastery");
  const canStart = selected.size > 0 && selectedBasicCount > 0;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const dismissNotice = () => {
    sessionStorage.setItem(NOTICE_KEY, "1");
    setNoticeDismissed(true);
  };

  return (
    <section className="space-y-4">
      <header>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-ink-500 hover:underline dark:text-ink-300"
        >
          ← Back
        </button>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy dark:text-gold sm:text-3xl">
          Flashcard Survivors
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          Bullet-hell review mode. Answer cards to fire; survive as long as
          you can. Reviewed cards aren't affected — your normal schedule
          stays untouched.
        </p>
      </header>

      {!noticeDismissed && (
        <div className="card-surface flex items-start justify-between gap-3 border-l-4 border-gold p-3">
          <p className="text-sm text-ink-700 dark:text-ink-300">
            <span className="font-semibold text-ink-900 dark:text-dark-ink">
              Recommended:
            </span>{" "}
            Flashcard Survivors works best with decks made of basic
            front/back cards. Cloze, image-occlusion, and draw cards are
            skipped automatically in this mode.
          </p>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label="Dismiss recommendation"
            className="rounded-full p-1 text-ink-500 hover:bg-ink-100 dark:hover:bg-dark-surface"
          >
            ✕
          </button>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Decks
        </p>
        <ul className="card-surface divide-y divide-ink-100 dark:divide-dark-bg">
          {decks?.map((d) => {
            const stats = basicByDeck[d.id];
            const pct = stats && stats.total > 0 ? Math.round((stats.basic / stats.total) * 100) : 0;
            const isLow = stats && stats.total > 0 && pct < 50;
            return (
              <li key={d.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-ink-100/40 dark:hover:bg-dark-bg">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="h-5 w-5"
                  />
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: d.colour }}
                  />
                  <DeckLabel deck={d} />
                  {stats && (
                    <span className="ml-auto flex items-center gap-1 text-xs text-ink-500 dark:text-ink-300">
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] dark:bg-dark-surface">
                        {pct}% basic
                      </span>
                      {isLow && (
                        <span className="rounded-full bg-hard/20 px-2 py-0.5 text-[11px] text-hard">
                          Mostly non-basic
                        </span>
                      )}
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card-surface space-y-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Difficulty
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(["easy", "normal", "hard"] as const).map((d) => (
              <DiffPill key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                {d}
              </DiffPill>
            ))}
            <DiffPill
              active={difficulty === "insane"}
              onClick={() => insanityUnlocked && setDifficulty("insane")}
              disabled={!insanityUnlocked}
              title={insanityUnlocked ? undefined : "Unlock the Forgotten Mastery node first."}
            >
              insane
            </DiffPill>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Input mode
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <DiffPill active={inputMode === "keyboard"} onClick={() => setInputMode("keyboard")}>
              keyboard — type the back
            </DiffPill>
            <DiffPill
              active={inputMode === "tap"}
              onClick={() => tapEligible && setInputMode("tap")}
              disabled={!tapEligible}
              title={tapEligible ? undefined : `Need at least 4 basic cards across selected decks (have ${selectedBasicCount}).`}
            >
              tap — pick from 4 options
            </DiffPill>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenMastery}
            className="rounded-xl border border-ink-300 bg-surface px-4 py-2 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
          >
            Mastery Tree
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="rounded-xl border border-ink-300 bg-surface px-4 py-2 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
            aria-label="How to play"
          >
            How to play
          </button>
        </div>
        <Button
          onClick={() =>
            onStart({ deckIds: [...selected], difficulty, inputMode })
          }
          disabled={!canStart}
        >
          {canStart ? "Start run" : "Pick at least one deck"}
        </Button>
      </div>

      {helpOpen && (
        <HowToPlayModal
          inputMode={inputMode}
          isPreRun={false}
          onStart={() => setHelpOpen(false)}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </section>
  );
}

function DeckLabel({ deck }: { deck: Deck }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-ink-900 dark:text-dark-ink">
        {deck.name}
      </span>
      {deck.subject && (
        <span className="text-[11px] text-ink-500 dark:text-ink-300">
          {deck.subject}
        </span>
      )}
    </span>
  );
}

function DiffPill({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`tap-target rounded-full px-3 text-xs font-semibold transition-colors ${
        active
          ? "bg-navy text-cream"
          : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}
