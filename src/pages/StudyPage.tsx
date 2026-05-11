import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  addReviewEvent,
  recordSession,
  updateCard,
  useDeck,
  useProfile,
  type Card,
  type Rating,
} from "../db";
import { newId } from "../db/ids";
import { applyRating } from "../srs/scheduler";
import {
  buildStandardSession,
  type SessionQueue,
} from "../study/sessionBuilder";
import { bumpStreakForReview } from "../study/streak";
import { CardReviewer } from "../components/study/CardReviewer";
import { SessionTopBar } from "../components/study/SessionTopBar";
import { SessionSummary } from "../components/study/SessionSummary";
import { ConfirmDialog } from "../components/ConfirmDialog";

export function StudyPage() {
  const [params] = useSearchParams();
  const deckId = params.get("deck") ?? undefined;
  const includeSubDecks = params.get("includeSubDecks") !== "false";

  if (!deckId) return <NoDeckChosen />;
  return <StudyRunner deckId={deckId} includeSubDecks={includeSubDecks} />;
}

function StudyRunner({
  deckId,
  includeSubDecks,
}: {
  deckId: string;
  includeSubDecks: boolean;
}) {
  const navigate = useNavigate();
  const deck = useDeck(deckId);
  const profile = useProfile();

  const [queue, setQueue] = useState<SessionQueue | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [done, setDone] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);

  const sessionIdRef = useRef<string>(newId());
  const sessionStartRef = useRef<number>(Date.now());
  const cardStartRef = useRef<number>(Date.now());
  // Track whether we've already recorded the session row so the
  // finalisation effect can't fire twice in StrictMode.
  const recordedRef = useRef<boolean>(false);

  // Build the queue once when the deck + limits are available.
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
        if (cancelled) return;
        setQueue(q);
        sessionStartRef.current = Date.now();
        cardStartRef.current = Date.now();
      })
      .catch((err) => {
        if (cancelled) return;
        setQueueError(
          err instanceof Error ? err.message : "Couldn't build the session",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [deck, deckId, includeSubDecks, newCardLimit, reviewLimit]);

  const card: Card | undefined = useMemo(() => {
    if (!queue) return undefined;
    return queue.cards[index];
  }, [queue, index]);

  // Reset the per-card stopwatch each time the card changes.
  useEffect(() => {
    cardStartRef.current = Date.now();
  }, [card?.id]);

  if (!deck) {
    return <NoDeckChosen />;
  }
  if (queueError) {
    return <FailureNotice message={queueError} deckId={deckId} />;
  }
  if (!queue) {
    return (
      <p className="mt-8 text-center text-sm text-ink-500">
        Loading your cards...
      </p>
    );
  }
  if (queue.cards.length === 0) {
    return <NothingDue deckId={deckId} />;
  }
  if (done) {
    return (
      <SessionSummary
        ratings={ratings}
        totalTimeMs={Date.now() - sessionStartRef.current}
        reviewsRemaining={queue.reviewsRemaining}
        newRemaining={queue.newRemaining}
        deckId={deckId}
      />
    );
  }

  const handleRate = async (rating: Rating) => {
    if (!card) return;
    const now = Date.now();
    const timeTakenMs = now - cardStartRef.current;
    const previousState = card.fsrs;
    const { next } = applyRating(previousState, rating, new Date(now));

    await updateCard(card.id, { fsrs: next });
    await addReviewEvent({
      cardId: card.id,
      deckId: card.deckId,
      timestamp: now,
      rating,
      timeTakenMs,
      previousState,
      nextState: next,
      sessionId: sessionIdRef.current,
    });

    const nextRatings = [...ratings, rating];
    setRatings(nextRatings);

    if (index + 1 >= queue.cards.length) {
      if (!recordedRef.current) {
        recordedRef.current = true;
        await recordSession({
          id: sessionIdRef.current,
          startedAt: sessionStartRef.current,
          endedAt: now,
          deckIds: queue.deckIds,
          cardsReviewed: queue.cards.length,
          cardsCorrect: nextRatings.filter((r) => r >= 3).length,
          totalTimeMs: now - sessionStartRef.current,
          mode: "standard",
        });
        await bumpStreakForReview(new Date(now));
      }
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const exit = () => {
    navigate(`/decks/${deckId}`);
  };

  return (
    <div className="space-y-4">
      <SessionTopBar
        deckName={deck.name}
        progress={index}
        total={queue.cards.length}
        startedAt={sessionStartRef.current}
        showTimer={profile?.settings.showTimerInSession ?? true}
        onExit={() => {
          if (ratings.length === 0) exit();
          else setExitOpen(true);
        }}
      />

      {card && <CardReviewer card={card} onRate={handleRate} />}

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
      </div>
    </div>
  );
}

function FailureNotice({
  message,
  deckId,
}: {
  message: string;
  deckId: string;
}) {
  return (
    <div className="mt-12 text-center">
      <h1 className="text-xl font-semibold text-again">
        Couldn't start the session
      </h1>
      <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">{message}</p>
      <Link
        to={`/decks/${deckId}`}
        className="mt-4 inline-block text-navy underline dark:text-gold"
      >
        Back to deck
      </Link>
    </div>
  );
}
