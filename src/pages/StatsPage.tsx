import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDecks, useProfile } from "../db";
import { db } from "../db/schema";
import { StreakChip } from "../components/StreakChip";
import { CoinBalance } from "../components/gamification/CoinBalance";
import {
  computeOverallMasteryPct,
  rankForPct,
  RANKS,
  type RankInfo,
} from "../gamification/ranks";
import { Dialog } from "../components/Dialog";
import { Button } from "../components/Button";
import { AccuracyRing } from "../components/stats/AccuracyRing";
import { WeekChart } from "../components/stats/WeekChart";
import { YearHeatmap } from "../components/stats/YearHeatmap";
import {
  loadToday,
  loadWeek,
  loadYearHeatmap,
  loadSessionsOnDay,
  type TodayStats,
  type WeekStats,
  type YearHeatmap as YearHeatmapData,
} from "../study/statsAggregator";
import type { Session } from "../db";

type Tab = "today" | "week" | "alltime";

export function StatsPage() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-gold sm:text-3xl">
          Progress
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          Everything is computed from this device's review history.
        </p>
      </header>

      <RankCard />


      <div role="tablist" className="-mx-1 flex gap-1">
        <TabButton active={tab === "today"} onClick={() => setTab("today")}>
          Today
        </TabButton>
        <TabButton active={tab === "week"} onClick={() => setTab("week")}>
          This week
        </TabButton>
        <TabButton active={tab === "alltime"} onClick={() => setTab("alltime")}>
          All time
        </TabButton>
      </div>

      {tab === "today" && <TodayView />}
      {tab === "week" && <WeekView />}
      {tab === "alltime" && <AllTimeView />}
    </section>
  );
}

function RankCard() {
  const [pct, setPct] = useState<number | null>(null);
  const [rank, setRank] = useState<RankInfo | null>(null);
  const [ladderOpen, setLadderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    computeOverallMasteryPct().then((p) => {
      if (cancelled) return;
      setPct(p);
      setRank(rankForPct(p));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setLadderOpen(true)}
        aria-label="View rank ladder"
        className="card-surface flex w-full flex-wrap items-center justify-between gap-4 p-5 text-left transition-colors hover:bg-ink-100/40 dark:hover:bg-dark-surface/70"
      >
        <div className="flex items-center gap-3">
          <span className="text-4xl" aria-hidden>
            {rank?.icon ?? "○"}
          </span>
          <div>
            <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
              Your rank · tap to see the ladder
            </p>
            <p className="text-lg font-semibold text-ink-900 dark:text-dark-ink">
              {rank?.label ?? "..."}
            </p>
            <p className="text-xs text-ink-500 dark:text-ink-300">
              {pct === null ? "Calculating..." : `${pct.toFixed(0)}% of cards mature`}
            </p>
          </div>
        </div>
        <CoinBalance showRemaining />
      </button>
      <RankLadderDialog
        open={ladderOpen}
        onClose={() => setLadderOpen(false)}
        currentRankId={rank?.id}
        currentPct={pct ?? 0}
      />
    </>
  );
}

// Shows the full rank ladder so students know what they're working toward.
// Highlights the current rank and the next one up.
function RankLadderDialog({
  open,
  onClose,
  currentRankId,
  currentPct,
}: {
  open: boolean;
  onClose: () => void;
  currentRankId: string | undefined;
  currentPct: number;
}) {
  const currentIdx = currentRankId
    ? RANKS.findIndex((r) => r.id === currentRankId)
    : 0;
  const nextRank =
    currentIdx >= 0 && currentIdx < RANKS.length - 1
      ? RANKS[currentIdx + 1]
      : null;
  const pointsToNext = nextRank
    ? Math.max(0, nextRank.minPct - currentPct)
    : 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ranks you can earn"
      description="Ranks are based on how many cards have reached the 'mature' stage — scheduled more than three weeks ahead. Keep practising and they all unlock."
      size="md"
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ul className="space-y-1">
        {RANKS.map((r, idx) => {
          const isCurrent = r.id === currentRankId;
          const reached = idx <= currentIdx;
          return (
            <li
              key={r.id}
              className={`flex items-start gap-3 rounded-xl p-3 ${
                isCurrent
                  ? "bg-navy/10 dark:bg-gold/15"
                  : reached
                    ? ""
                    : "opacity-70"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {r.icon}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink-900 dark:text-dark-ink">
                    {r.label}
                  </p>
                  <p className="text-xs text-ink-500 dark:text-ink-300">
                    From {r.minPct}%
                  </p>
                </div>
                {r.message && (
                  <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-300">
                    {r.message}
                  </p>
                )}
                {isCurrent && nextRank && (
                  <p className="mt-1 text-xs text-navy dark:text-gold">
                    {pointsToNext.toFixed(1)}% to {nextRank.label}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

function TabButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`tap-target whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
        active
          ? "bg-navy text-cream"
          : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

// ---- Today ----

function TodayView() {
  const [data, setData] = useState<TodayStats | null>(null);
  const profile = useProfile();

  useEffect(() => {
    let cancelled = false;
    loadToday().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <Loading />;

  if (data.cards === 0) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-base font-medium text-ink-900 dark:text-dark-ink">
          No reviews yet today
        </p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
          Start a study session and your numbers will show up here.
        </p>
        <Link
          to="/"
          className="mt-3 inline-block text-navy underline dark:text-gold"
        >
          Browse decks
        </Link>
      </div>
    );
  }

  const minutes = Math.floor(data.totalTimeMs / 60000);
  const seconds = Math.floor((data.totalTimeMs % 60000) / 1000);

  return (
    <div className="space-y-4">
      <div className="card-surface grid grid-cols-1 items-center gap-6 p-6 sm:grid-cols-[auto,1fr]">
        <div className="text-navy dark:text-gold">
          <AccuracyRing accuracy={data.accuracy} label="Accuracy" />
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Cards" value={String(data.cards)} />
          <Stat
            label="Time"
            value={`${minutes}m ${String(seconds).padStart(2, "0")}s`}
          />
          <Stat
            label="Correct"
            value={`${data.correct}`}
            subtitle={`of ${data.cards}`}
          />
        </dl>
      </div>

      <div className="card-surface p-6">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          Streak
        </p>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
          Days in a row with at least one review across any deck.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StreakChip days={profile?.streakDays ?? 0} tone="bold" />
          {profile && profile.longestStreak > (profile.streakDays ?? 0) && (
            <span className="text-xs text-ink-500 dark:text-ink-300">
              Best: {profile.longestStreak} day{profile.longestStreak === 1 ? "" : "s"}
            </span>
          )}
          {profile?.restDayUsedDate && (
            <span className="text-xs text-hard">
              Rest day used (current streak)
            </span>
          )}
        </div>
      </div>

      <div className="card-surface p-6">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          How you rated today
        </p>
        <RatingBreakdown counts={data.byRating} total={data.cards} />
      </div>
    </div>
  );
}

// ---- Week ----

function WeekView() {
  const [data, setData] = useState<WeekStats | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWeek().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Cards reviewed" value={String(data.totalCards)} />
        <StatCard label="Average accuracy" value={`${data.averageAccuracy}%`} />
      </div>
      <div className="card-surface text-navy dark:text-gold p-2 sm:p-4">
        <WeekChart week={data} onSelectDay={(d) => setSelectedDay(d)} />
      </div>
      {selectedDay && (
        <DaySessionsList
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ---- All time ----

function AllTimeView() {
  const [data, setData] = useState<YearHeatmapData | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadYearHeatmap().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="card-surface text-navy dark:text-gold p-4">
        <YearHeatmap data={data} onSelectDay={(d) => setSelectedDay(d)} />
      </div>
      {selectedDay && (
        <DaySessionsList
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ---- Shared widgets ----

function Loading() {
  return <p className="text-sm text-ink-500">Loading...</p>;
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold text-ink-900 dark:text-dark-ink">
        {value}
      </dd>
      {subtitle && (
        <p className="text-xs text-ink-500 dark:text-ink-300">{subtitle}</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface p-5">
      <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-dark-ink">
        {value}
      </p>
    </div>
  );
}

const RATING_LABELS = ["Again", "Hard", "Good", "Easy"];
const RATING_BG = ["bg-again", "bg-hard", "bg-good", "bg-easy"];

function RatingBreakdown({
  counts,
  total,
}: {
  counts: Record<1 | 2 | 3 | 4, number>;
  total: number;
}) {
  const max = Math.max(1, ...Object.values(counts));
  return (
    <ul className="mt-3 space-y-2">
      {[1, 2, 3, 4].map((r) => {
        const count = counts[r as 1 | 2 | 3 | 4];
        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
        return (
          <li key={r} className="flex items-center gap-3 text-sm">
            <span className="w-14 text-ink-700 dark:text-ink-300">
              {RATING_LABELS[r - 1]}
            </span>
            <span className="flex-1">
              <span
                className={`block h-3 rounded-full ${RATING_BG[r - 1]}`}
                style={{
                  width: `${(count / max) * 100}%`,
                  minWidth: count > 0 ? 4 : 0,
                }}
              />
            </span>
            <span className="w-16 text-right text-ink-900 dark:text-dark-ink">
              {count} · {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DaySessionsList({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadSessionsOnDay(date).then((s) => {
      if (!cancelled) setSessions(s);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          Sessions on {formatHumanDate(date)}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drill-down"
          className="text-xs text-ink-500 hover:underline dark:text-ink-300"
        >
          Close
        </button>
      </div>
      {!sessions ? (
        <p className="mt-2 text-sm text-ink-500">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-300">
          No sessions started this day. (Reviews may have happened inside a
          session that started the day before.)
        </p>
      ) : (
        <ul className="mt-3 space-y-3 text-sm">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessionRow({ session }: { session: Session }) {
  const decks = useDecks();
  const [topTags, setTopTags] = useState<{ tag: string; count: number }[] | null>(
    null,
  );

  // Pull this session's review events, then the cards behind them, to surface
  // the most common tags. Gives the day drill-down some idea of *what* the
  // student practised — not just how many cards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reviews = await db.reviews
        .where("sessionId")
        .equals(session.id)
        .toArray();
      const cardIds = Array.from(new Set(reviews.map((r) => r.cardId)));
      if (cardIds.length === 0) {
        if (!cancelled) setTopTags([]);
        return;
      }
      const cards = await db.cards.bulkGet(cardIds);
      const counts = new Map<string, number>();
      for (const c of cards) {
        if (!c) continue;
        for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const sorted = [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      if (!cancelled) setTopTags(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  const start = new Date(session.startedAt);
  const end = new Date(session.endedAt);
  const accuracy =
    session.cardsReviewed === 0
      ? 0
      : Math.round((session.cardsCorrect / session.cardsReviewed) * 100);
  const minutes = Math.floor(session.totalTimeMs / 60000);

  const deckNames = decks
    ? session.deckIds
        .map((id) => decks.find((d) => d.id === id)?.name)
        .filter((n): n is string => Boolean(n))
    : [];

  return (
    <li className="rounded-lg border border-ink-100 px-3 py-2 dark:border-dark-surface">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500 dark:text-ink-300">
          {formatHumanTime(start)} - {formatHumanTime(end)}
        </span>
        {session.mode === "custom-study" && (
          <span className="inline-flex items-center rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-navy dark:text-gold">
            Custom
          </span>
        )}
        <span className="text-ink-900 dark:text-dark-ink">
          {session.cardsReviewed} card{session.cardsReviewed === 1 ? "" : "s"}
        </span>
        <span className="text-ink-500 dark:text-ink-300">· {accuracy}% accurate</span>
        <span className="text-ink-500 dark:text-ink-300">· {minutes}m</span>
      </div>
      {deckNames.length > 0 && (
        <p className="mt-1 text-xs text-ink-700 dark:text-ink-300">
          Decks:{" "}
          <span className="text-ink-900 dark:text-dark-ink">
            {deckNames.join(", ")}
          </span>
        </p>
      )}
      {topTags && topTags.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-1">
          {topTags.map((t) => (
            <li
              key={t.tag}
              className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] text-navy dark:bg-gold/15 dark:text-gold"
            >
              {t.tag} · {t.count}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function formatHumanDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function formatHumanTime(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
