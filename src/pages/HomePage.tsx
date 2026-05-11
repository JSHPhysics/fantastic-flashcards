import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile } from "../db";
import { DeckTree } from "../components/DeckTree";
import { CreateDeckDialog } from "../components/CreateDeckDialog";
import { Fab } from "../components/Fab";
import { StreakChip } from "../components/StreakChip";

export function HomePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();
  const profile = useProfile();
  const streakDays = profile?.streakDays ?? 0;
  const longestStreak = profile?.longestStreak ?? 0;

  return (
    <>
      <section className="mt-2">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy dark:text-gold">
              Your decks
            </h1>
            <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              Tap a deck to study or edit it. Nothing here leaves the device.
            </p>
          </div>
          {streakDays > 0 && (
            <div className="flex flex-col items-end gap-1">
              <StreakChip days={streakDays} tone="bold" />
              {longestStreak > streakDays && (
                <p className="text-xs text-ink-500 dark:text-ink-300">
                  Longest: {longestStreak} day{longestStreak === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}
        </header>
        <div className="mb-3 flex flex-wrap justify-end gap-4 text-sm">
          <Link
            to="/import/quizlet"
            className="text-navy underline dark:text-gold"
          >
            Import from Quizlet →
          </Link>
          <Link
            to="/study/custom"
            className="text-navy underline dark:text-gold"
          >
            Custom study →
          </Link>
        </div>
        <DeckTree />
      </section>

      <Fab
        label="Create deck"
        onClick={() => setCreateOpen(true)}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </Fab>

      <CreateDeckDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(deck) => navigate(`/decks/${deck.id}`)}
      />
    </>
  );
}
