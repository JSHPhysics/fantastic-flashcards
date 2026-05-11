import { Link, useNavigate, useParams } from "react-router-dom";
import { useDeck, useCardsInDeck, type Card } from "../db";
import { Button } from "../components/Button";
import { DeckActionsMenu } from "../components/DeckActionsMenu";
import { useState } from "react";
import { CreateDeckDialog } from "../components/CreateDeckDialog";

export function DeckDetailPage() {
  const { id } = useParams();
  const deck = useDeck(id);
  const cards = useCardsInDeck(id);
  const navigate = useNavigate();
  const [createSubOpen, setCreateSubOpen] = useState(false);

  if (!deck) {
    return (
      <div className="mt-8 text-center">
        <p className="text-base text-ink-700 dark:text-ink-300">
          Deck not found.
        </p>
        <Link to="/" className="mt-3 inline-block text-navy underline dark:text-gold">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/"
            className="text-sm text-ink-500 hover:underline dark:text-ink-300"
          >
            ← All decks
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight text-navy dark:text-gold">
            <span
              aria-hidden
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: deck.colour }}
            />
            <span className="break-words">{deck.name}</span>
          </h1>
          {deck.subject && (
            <span className="mt-2 inline-block rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-700 dark:bg-dark-surface dark:text-ink-300">
              {deck.subject}
            </span>
          )}
          {deck.description && (
            <p className="mt-2 max-w-prose text-sm text-ink-700 dark:text-ink-300">
              {deck.description}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-500 dark:text-ink-300">
            {deck.cardCount} cards in this deck
            {deck.descendantCardCount > deck.cardCount &&
              ` · ${deck.descendantCardCount} including sub-decks`}
          </p>
        </div>
        <DeckActionsMenu deck={deck} />
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          onClick={() =>
            navigate(`/study?deck=${deck.id}&includeSubDecks=true`)
          }
          disabled={deck.descendantCardCount === 0}
        >
          Study
        </Button>
        <Button
          variant="secondary"
          onClick={() => navigate(`/cards/new?deckId=${deck.id}`)}
        >
          Add card
        </Button>
        <Button
          variant="ghost"
          onClick={() => setCreateSubOpen(true)}
        >
          Add sub-deck
        </Button>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
        Cards
      </h2>
      <CardList cards={cards} />

      <CreateDeckDialog
        open={createSubOpen}
        onClose={() => setCreateSubOpen(false)}
        initialParentId={deck.id}
      />
    </section>
  );
}

function CardList({ cards }: { cards: Card[] | undefined }) {
  if (cards === undefined) {
    return <p className="text-sm text-ink-500">Loading...</p>;
  }
  if (cards.length === 0) {
    return (
      <div className="card-surface p-6 text-center">
        <p className="text-base font-medium text-ink-900 dark:text-dark-ink">
          No cards in this deck yet
        </p>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
          Tap "Add card" to create your first one.
        </p>
      </div>
    );
  }
  return (
    <ul className="card-surface divide-y divide-ink-100 dark:divide-dark-bg">
      {cards.map((card) => (
        <li key={card.id}>
          <Link
            to={`/cards/${card.id}/edit`}
            className="block px-4 py-3 transition-colors hover:bg-ink-100/50 dark:hover:bg-dark-bg"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base text-ink-900 dark:text-dark-ink">
                  {cardPreviewFront(card)}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-500 dark:text-ink-300">
                  {cardPreviewBack(card)}
                </p>
              </div>
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] uppercase tracking-wider text-ink-700 dark:bg-dark-bg dark:text-ink-300">
                {card.type}
              </span>
            </div>
            {card.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {card.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] text-navy dark:bg-gold/15 dark:text-gold"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function cardPreviewFront(card: Card): string {
  switch (card.content.type) {
    case "basic":
      return card.content.front.text || "(empty)";
    case "cloze":
      return card.content.text || "(empty)";
    case "mcq":
      return card.content.question.text || "(empty)";
    case "typed":
      return card.content.prompt.text || "(empty)";
    case "occlusion":
      return "Image occlusion";
    case "drawing":
      return card.content.prompt.text || "Drawing prompt";
  }
}

function cardPreviewBack(card: Card): string {
  switch (card.content.type) {
    case "basic":
      return card.content.back.text;
    case "cloze":
      return `cloze ${card.content.clozeNumber}`;
    case "mcq": {
      const correct = card.content.options.find((o) => o.correct);
      return correct ? correct.text : "(no correct option)";
    }
    case "typed":
      return card.content.acceptedAnswers.join(", ");
    case "occlusion":
      return "Tap to reveal";
    case "drawing":
      return "Model answer hidden";
  }
}
