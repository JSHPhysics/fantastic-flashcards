import { useState } from "react";
import type { ClozeContent, Rating } from "../../db";
import { renderClozePreview } from "../../cards/cloze";
import { RatingButtons } from "./RatingButtons";
import { Button } from "../Button";

interface ClozeReviewProps {
  content: ClozeContent;
  onRate: (rating: Rating) => void;
}

export function ClozeReview({ content, onRate }: ClozeReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const masked = renderClozePreview(content.text, content.clozeNumber);
  // When revealed, replace every cloze marker with its hidden text so the
  // student sees the original sentence.
  const full = content.text.replace(
    /\{\{c\d+::([\s\S]+?)\}\}/g,
    (_match, body: string) => body,
  );

  return (
    <div className="space-y-4">
      <div className="card-surface p-6">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Fill in the blank
        </p>
        <p className="mt-2 whitespace-pre-wrap text-card-body text-ink-900 dark:text-dark-ink">
          {revealed ? full : masked}
        </p>
      </div>
      {revealed ? (
        <RatingButtons onRate={onRate} />
      ) : (
        <div className="flex justify-center">
          <Button onClick={() => setRevealed(true)}>Show answer</Button>
        </div>
      )}
    </div>
  );
}
