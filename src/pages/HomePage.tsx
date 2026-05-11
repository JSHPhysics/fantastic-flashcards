import { Link } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function HomePage() {
  return (
    <PagePlaceholder
      title="Your decks"
      subtitle="Local-first flashcards. Nothing leaves this device unless you export it."
    >
      <div className="card-surface flex flex-col gap-4 p-6">
        <p className="text-ink-700 dark:text-ink-300">
          Deck tree, due-today badges, and the create-deck FAB land in Session 3.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/study"
            className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-navy/90"
          >
            Open study screen
          </Link>
          <Link
            to="/stats"
            className="tap-target inline-flex items-center justify-center rounded-xl border border-ink-300 px-5 text-sm font-semibold text-navy transition-colors hover:bg-ink-100 dark:border-dark-surface dark:text-gold dark:hover:bg-dark-surface"
          >
            View stats
          </Link>
        </div>
      </div>
    </PagePlaceholder>
  );
}
