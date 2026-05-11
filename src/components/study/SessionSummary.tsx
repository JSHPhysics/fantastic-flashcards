import { Link } from "react-router-dom";
import type { Rating } from "../../db";
import { useProfile } from "../../db";

interface SessionSummaryProps {
  ratings: Rating[];
  totalTimeMs: number;
  reviewsRemaining: number;
  newRemaining: number;
  deckId: string;
  mode?: "standard" | "custom-study";
}

const RATING_LABELS: Record<Rating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

const RATING_BG: Record<Rating, string> = {
  1: "bg-again",
  2: "bg-hard",
  3: "bg-good",
  4: "bg-easy",
};

export function SessionSummary({
  ratings,
  totalTimeMs,
  reviewsRemaining,
  newRemaining,
  deckId,
  mode = "standard",
}: SessionSummaryProps) {
  const profile = useProfile();
  const cards = ratings.length;
  const correct = ratings.filter((r) => r >= 3).length;
  const accuracy = cards === 0 ? 0 : Math.round((correct / cards) * 100);
  const minutes = Math.floor(totalTimeMs / 60000);
  const seconds = Math.floor((totalTimeMs % 60000) / 1000);

  const counts: Record<Rating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of ratings) counts[r] += 1;
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <section className="space-y-6">
      <header className="text-center">
        {mode === "custom-study" && (
          <span className="inline-flex items-center rounded-full bg-gold/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-navy dark:text-gold">
            Custom study
          </span>
        )}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy dark:text-gold">
          Session complete
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          {cards === 0
            ? "No cards reviewed."
            : `Reviewed ${cards} card${cards === 1 ? "" : "s"} in ${minutes}m ${seconds}s.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Cards" value={String(cards)} />
        <StatCard label="Accuracy" value={`${accuracy}%`} />
        <StatCard
          label="Streak"
          value={`${profile?.streakDays ?? 0} day${(profile?.streakDays ?? 0) === 1 ? "" : "s"}`}
          subtitle={
            profile?.restDayUsedDate
              ? "Rest day used"
              : profile?.longestStreak
                ? `Best: ${profile.longestStreak}`
                : undefined
          }
        />
      </div>

      <div className="card-surface p-6">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          How you rated
        </p>
        <ul className="mt-3 space-y-2">
          {([1, 2, 3, 4] as Rating[]).map((r) => (
            <li key={r} className="flex items-center gap-3 text-sm">
              <span className="w-14 text-ink-700 dark:text-ink-300">
                {RATING_LABELS[r]}
              </span>
              <span className="flex-1">
                <span
                  className={`block h-3 rounded-full ${RATING_BG[r]}`}
                  style={{
                    width: `${(counts[r] / maxCount) * 100}%`,
                    minWidth: counts[r] > 0 ? 4 : 0,
                  }}
                />
              </span>
              <span className="w-6 text-right text-ink-900 dark:text-dark-ink">
                {counts[r]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {(reviewsRemaining > 0 || newRemaining > 0) && (
        <div className="card-surface p-4 text-sm text-ink-700 dark:text-ink-300">
          {reviewsRemaining > 0 && (
            <p>
              {reviewsRemaining} more card{reviewsRemaining === 1 ? "" : "s"} due today.
            </p>
          )}
          {newRemaining > 0 && (
            <p>
              {newRemaining} unseen card{newRemaining === 1 ? "" : "s"} still waiting.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        {mode === "custom-study" ? (
          <>
            <Link
              to="/study/custom"
              className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
            >
              Build another custom session
            </Link>
            <Link
              to="/"
              className="tap-target inline-flex items-center justify-center rounded-xl border border-ink-300 bg-surface px-5 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
            >
              Home
            </Link>
          </>
        ) : (
          <>
            <Link
              to={deckId ? `/decks/${deckId}` : "/"}
              className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm hover:bg-navy/90"
            >
              {deckId ? "Back to deck" : "Home"}
            </Link>
            <Link
              to="/"
              className="tap-target inline-flex items-center justify-center rounded-xl border border-ink-300 bg-surface px-5 text-sm font-semibold text-navy hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:text-gold"
            >
              Home
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="card-surface p-5 text-center">
      <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-dark-ink">
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
          {subtitle}
        </p>
      )}
    </div>
  );
}

