// Four-button rating row used by Basic, Cloze, Occlusion, and Drawing cards
// once the student has revealed the answer. MCQ and Typed cards infer the
// rating from the student's input and bypass this row.

import type { Rating } from "../../db";

const RATINGS: { rating: Rating; label: string; bg: string }[] = [
  { rating: 1, label: "Again", bg: "bg-again" },
  { rating: 2, label: "Hard", bg: "bg-hard" },
  { rating: 3, label: "Good", bg: "bg-good" },
  { rating: 4, label: "Easy", bg: "bg-easy" },
];

export function RatingButtons({
  onRate,
  disabled,
}: {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Rate how well you remembered this card"
      className="grid grid-cols-4 gap-2"
    >
      {RATINGS.map(({ rating, label, bg }) => (
        <button
          key={rating}
          type="button"
          disabled={disabled}
          onClick={() => onRate(rating)}
          className={`tap-target rounded-xl px-3 py-3 text-sm font-semibold text-cream shadow-sm transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 ${bg}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
