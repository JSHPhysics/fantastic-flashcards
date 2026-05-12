// Dispatches a card to the right per-type review component. The dispatcher
// is keyed on card.id so React unmounts the previous card cleanly when the
// student advances - reset state, kill any in-progress TTS, etc.

import { useDeck, type Card, type Rating } from "../../db";
import { BasicReview } from "./BasicReview";
import { ClozeReview } from "./ClozeReview";
import { McqReview } from "./McqReview";
import { TypedReview } from "./TypedReview";
import { OcclusionReview } from "./OcclusionReview";
import { DrawingReview } from "./DrawingReview";

interface CardReviewerProps {
  card: Card;
  onRate: (rating: Rating) => void;
}

export function CardReviewer({ card, onRate }: CardReviewerProps) {
  const c = card.content;
  // Custom-study sessions can mix cards from multiple decks, so we look up
  // each card's deck rather than threading one deck through from the runner.
  // useLiveQuery makes this a cheap memoised read.
  const deck = useDeck(card.deckId);
  const baseLanguage = deck?.baseLanguage;
  switch (c.type) {
    case "basic":
      return (
        <BasicReview
          key={card.id}
          content={c}
          onRate={onRate}
          baseLanguage={baseLanguage}
        />
      );
    case "cloze":
      return <ClozeReview key={card.id} content={c} onRate={onRate} />;
    case "mcq":
      return <McqReview key={card.id} content={c} onRate={onRate} />;
    case "typed":
      return <TypedReview key={card.id} content={c} onRate={onRate} />;
    case "occlusion":
      return <OcclusionReview key={card.id} content={c} onRate={onRate} />;
    case "drawing":
      return <DrawingReview key={card.id} content={c} onRate={onRate} />;
  }
}
