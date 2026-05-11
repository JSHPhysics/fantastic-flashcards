import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeckTree } from "../components/DeckTree";
import { CreateDeckDialog } from "../components/CreateDeckDialog";
import { Fab } from "../components/Fab";

export function HomePage() {
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <section className="mt-2">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy dark:text-gold">
              Your decks
            </h1>
            <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
              Tap a deck to study or edit it. Nothing here leaves the device.
            </p>
          </div>
        </header>
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
