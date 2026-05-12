import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  addReviewEvent,
  recordSession,
  updateCard,
  useDeck,
  useDecks,
  useProfile,
  type Card,
  type CustomStudyConfig,
  type Rating,
} from "../db";
import { newId } from "../db/ids";
import { applyRating } from "../srs/scheduler";
import {
  buildStandardSession,
  type SessionQueue,
} from "../study/sessionBuilder";
import {
  buildCustomStudySession,
  type CustomSessionQueue,
} from "../study/customStudyBuilder";
import { bumpStreakForReview } from "../study/streak";
import { CardReviewer } from "../components/study/CardReviewer";
import { SessionTopBar } from "../components/study/SessionTopBar";
import { SessionSummary } from "../components/study/SessionSummary";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RankUpDialog } from "../components/gamification/RankUpDialog";
import {
  awardCoinsForReview,
  awardDeckCompleteBonus,
} from "../gamification/coins";
import {
  computeOverallMasteryPct,
  detectRankUp,
  rankForPct,
  type RankInfo,
} from "../gamification/ranks";
import { updateSettings } from "../db";

interface CustomStudyLocationState {
  customConfig: CustomStudyConfig;
  updateSpacedRepetition: boolean;
}

export function StudyPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const state = location.state as CustomStudyLocationState | null;

  if (state?.customConfig) {
    return (
      <CustomRunner
        config={state.customConfig}
        updateSpacedRepetition={state.updateSpacedRepetition}
      />
    );
  }

  const deckId = params.get("deck") ?? undefined;
  const includeSubDecks = params.get("includeSubDecks") !== "false";
  if (!deckId) return <NoDeckChosen />;
  return <StandardRunner deckId={deckId} includeSubDecks={includeSubDecks} />;
}

// ---- Standard mode ----

function StandardRunner({
  deckId,
  includeSubDecks,
}: {
  deckId: string;
  includeSubDecks: boolean;
}) {
  const deck = useDeck(deckId);
  const profile = useProfile();
  const [queue, setQueue] = useState<SessionQueue | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  const newCardLimit = profile?.settings.defaultDailyNewLimit ?? 20;
  const reviewLimit = profile?.settings.defaultDailyReviewLimit ?? 200;

  useEffect(() => {
    if (!deck) return;
    let cancelled = false;
    buildStandardSession({
      rootDeckId: deckId,
      includeSubDecks,
      newCardLimit,
      reviewLimit,
    })
      .then((q) => {
        if (!cancelled) setQueue(q);
      })
      .catch((err) => {
        if (!cancelled)
          setQueueError(
            err instanceof Error ? err.message : "Couldn't build the session",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [deck, deckId, includeSubDecks, newCardLimit, reviewLimit]);

  if (!deck) return <NoDeckChosen />;
  if (queueError) return <FailureNotice message={queueError} deckId={deckId} />;
  if (!queue) {
    return (
      <p className="mt-8 text-center text-sm text-ink-500">
        Loading your cards...
      </p>
    );
  }
  if (queue.cards.length === 0) return <NothingDue deckId={deckId} />;
  return (
    <Runner
      deckName={deck.name}
      cards={queue.cards}
      deckIds={queue.deckIds}
      reviewsRemaining={queue.reviewsRemaining}
      newRemaining={queue.newRemaining}
      mode="standard"
      updateSpacedRepetition
      backLink={`/decks/${deckId}`}
    />
  );
}

// ---- Custom mode ----

function CustomRunner({
  config,
  updateSpacedRepetition,
}: {
  config: CustomStudyConfig;
  updateSpacedRepetition: boolean;
}) {
  const decks = useDecks();
  const [queue, setQueue] = useState<CustomSessionQueue | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildCustomStudySession(config)
      .then((q) => {
        if (!cancelled) setQueue(q);
      })
      .catch((err) => {
        if (!cancelled)
          setQueueError(
            err instanceof Error ? err.message : "Couldn't build the session",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  // Pick a representative deck name for the top bar. If the user selected
  // exactly one deck we use its name; otherwise "Custom".
  const deckName = useMemo(() => {
    if (!decks) return "Custom";
    if (config.deckIds.length === 1) {
      const d = decks.find((x) => x.id === config.deckIds[0]);
      return d?.name ?? "Custom";
    }
    return `Custom (${config.deckIds.length} decks)`;
  }, [decks, config.deckIds]);

  if (queueError)
    return <FailureNotice message={queueError} deckId={config.deckIds[0]} />;
  if (!queue) {
    return (
      <p className="mt-8 text-center text-sm text-ink-500">
        Building your custom session...
      </p>
    );
  }
  if (queue.cards.length === 0) return <NoCustomMatches />;
  return (
    <Runner
      deckName={deckName}
      cards={queue.cards}
      deckIds={queue.deckIds}
      reviewsRemaining={0}
      newRemaining={0}
      mode="custom-study"
      customConfig={config}
      updateSpacedRepetition={updateSpacedRepetition}
      backLink="/"
    />
  );
}

// ---- Shared runner ----

function Runner({
  deckName,
  cards,
  deckIds,
  reviewsRemaining,
  newRemaining,
  mode,
  customConfig,
  updateSpacedRepetition,
  backLink,
}: {
  deckName: string;
  cards: Card[];
  deckIds: string[];
  reviewsRemaining: number;
  newRemaining: number;
  mode: "standard" | "custom-study";
  customConfig?: CustomStudyConfig;
  updateSpacedRepetition: boolean;
  backLink: string;
}) {
  const navigate = useNavigate();
  const profile = useProfile();

  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [done, setDone] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [rankUp, setRankUp] = useState<RankInfo | null>(null);

  const sessionIdRef = useRef<string>(newId());
  const sessionStartRef = useRef<number>(Date.now());
  const cardStartRef = useRef<number>(Date.now());
  const recordedRef = useRef<boolean>(false);
  // Captures the rank label at the start of the session so we can compare
  // against the end-of-session rank to detect a rank-up exactly once per
  // session — not once per card.
  const startRankRef = useRef<string | undefined>(undefined);

  // Snapshot starting rank when the session mounts (only when we have
  // cards to review). Skips for done sessions and zero-card runs.
  useEffect(() => {
    if (startRankRef.current !== undefined) return;
    if (cards.length === 0) return;
    let cancelled = false;
    computeOverallMasteryPct().then((pct) => {
      if (cancelled) return;
      const rank = rankForPct(pct);
      startRankRef.current = profile?.settings.lastKnownRank ?? rank.id;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  const card = cards[index];

  useEffect(() => {
    cardStartRef.current = Date.now();
  }, [card?.id]);

  if (done) {
    // Rank-up dialog is mounted alongside the summary so the celebration
    // overlays the "session complete" screen rather than disappearing when
    // we transition away from the active card view.
    return (
      <>
        <RankUpDialog rank={rankUp} onClose={() => setRankUp(null)} />
        <SessionSummary
          ratings={ratings}
          totalTimeMs={Date.now() - sessionStartRef.current}
          reviewsRemaining={reviewsRemaining}
          newRemaining={newRemaining}
          deckId={deckIds[0] ?? ""}
          mode={mode}
        />
      </>
    );
  }

  const handleRate = async (rating: Rating) => {
    if (!card) return;
    const now = Date.now();
    const timeTakenMs = now - cardStartRef.current;
    const previousState = card.fsrs;
    const { next } = applyRating(previousState, rating, new Date(now));

    // Custom study with updateSpacedRepetition off doesn't change the card's
    // FSRS state; we still record the ReviewEvent so stats stay honest, but
    // previousState === nextState reflects that the schedule didn't move.
    const shouldPersistFsrs =
      mode === "standard" || updateSpacedRepetition;
    if (shouldPersistFsrs) {
      await updateCard(card.id, { fsrs: next });
    }
    await addReviewEvent({
      cardId: card.id,
      deckId: card.deckId,
      timestamp: now,
      rating,
      timeTakenMs,
      previousState,
      nextState: shouldPersistFsrs ? next : previousState,
      sessionId: sessionIdRef.current,
    });

    // Coin economy. Base coin + first-attempt-correct bonus, daily cap +
    // dedup all handled inside awardCoinsForReview.
    await awardCoinsForReview({
      cardId: card.id,
      rating,
      now: new Date(now),
    });

    const nextRatings = [...ratings, rating];
    setRatings(nextRatings);

    if (index + 1 >= cards.length) {
      if (!recordedRef.current) {
        recordedRef.current = true;
        await recordSession({
          id: sessionIdRef.current,
          startedAt: sessionStartRef.current,
          endedAt: now,
          deckIds,
          cardsReviewed: cards.length,
          cardsCorrect: nextRatings.filter((r) => r >= 3).length,
          totalTimeMs: now - sessionStartRef.current,
          mode,
          customStudyConfig: customConfig,
        });
        // Both modes contribute to the global streak: the user practised
        // today either way.
        await bumpStreakForReview(new Date(now));

        // Deck-complete bonus: only the standard-mode "I finished the
        // queue for this deck" flow earns the +5; custom sessions can mix
        // multiple decks and pick a subset of cards so the concept of
        // "completed deck" doesn't cleanly apply.
        if (mode === "standard" && deckIds[0]) {
          await awardDeckCompleteBonus(deckIds[0], new Date(now));
        }

        // Rank-up check. Recompute mastery after the session's FSRS
        // updates have landed; compare to the rank captured at session
        // start. Show the popup once if the band changed.
        const newPct = await computeOverallMasteryPct();
        const newRank = rankForPct(newPct);
        const up = detectRankUp(startRankRef.current, newPct);
        if (up) setRankUp(up);
        // Persist the new rank so subsequent sessions compare against
        // this baseline (otherwise re-entering Study would always show
        // "Unranked -> Recruit" again).
        await updateSettings({ lastKnownRank: newRank.id });
      }
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const exit = () => navigate(backLink);

  return (
    <div className="space-y-4">
      <SessionTopBar
        deckName={deckName}
        progress={index}
        total={cards.length}
        startedAt={sessionStartRef.current}
        showTimer={profile?.settings.showTimerInSession ?? true}
        modeBadge={mode === "custom-study" ? "Custom" : undefined}
        onExit={() => {
          if (ratings.length === 0) exit();
          else setExitOpen(true);
        }}
      />

      {card && <CardReviewer card={card} onRate={handleRate} />}

      <RankUpDialog rank={rankUp} onClose={() => setRankUp(null)} />

      <ConfirmDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={exit}
        title="Stop this session?"
        description={`You've answered ${ratings.length} card${ratings.length === 1 ? "" : "s"} so far. Your progress on those is already saved.`}
        confirmLabel="Stop"
        destructive
      />
    </div>
  );
}

// ---- Notices ----

function NoDeckChosen() {
  return (
    <div className="mt-12 text-center">
      <h1 className="text-2xl font-semibold text-navy dark:text-gold">
        Pick a deck to study
      </h1>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">
        Open a deck and tap "Study" to start a session.
      </p>
      <Link
        to="/"
        className="mt-4 inline-block text-navy underline dark:text-gold"
      >
        Browse decks
      </Link>
    </div>
  );
}

function NothingDue({ deckId }: { deckId: string }) {
  return (
    <div className="mt-12 text-center">
      <h1 className="text-2xl font-semibold text-navy dark:text-gold">
        Nothing due right now
      </h1>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">
        You're caught up on this deck. Come back later, or add some new cards.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link
          to={`/decks/${deckId}`}
          className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
        >
          Back to deck
        </Link>
        <Link
          to={`/study/custom?deck=${deckId}`}
          className="tap-target inline-flex items-center justify-center rounded-xl border border-ink-300 bg-surface px-5 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
        >
          Custom study instead
        </Link>
      </div>
    </div>
  );
}

function NoCustomMatches() {
  return (
    <div className="mt-12 text-center">
      <h1 className="text-2xl font-semibold text-navy dark:text-gold">
        No cards match those filters
      </h1>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">
        Loosen the filters and try again.
      </p>
      <Link
        to="/study/custom"
        className="mt-4 inline-block text-navy underline dark:text-gold"
      >
        Back to setup
      </Link>
    </div>
  );
}

function FailureNotice({
  message,
  deckId,
}: {
  message: string;
  deckId: string | undefined;
}) {
  return (
    <div className="mt-12 text-center">
      <h1 className="text-xl font-semibold text-again">
        Couldn't start the session
      </h1>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">{message}</p>
      <Link
        to={deckId ? `/decks/${deckId}` : "/"}
        className="mt-4 inline-block text-navy underline dark:text-gold"
      >
        {deckId ? "Back to deck" : "Home"}
      </Link>
    </div>
  );
}
