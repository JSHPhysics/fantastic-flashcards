import { useState } from "react";
import type { DrawingContent, Rating } from "../../db";
import { DrawingRenderer } from "../cards/drawing/DrawingRenderer";
import { RichFieldRender } from "../media/RichFieldPreview";
import { RatingButtons } from "./RatingButtons";
import { Button } from "../Button";

interface DrawingReviewProps {
  content: DrawingContent;
  onRate: (rating: Rating) => void;
}

// Drawing review v1: prompt + background, "Show answer" reveals the model.
// The full student-canvas + reveal-mode cycling experience from Playbook 7
// will land alongside the iPad polish pass; v1 just supports self-rated
// comparison via reveal-on-tap.

export function DrawingReview({ content, onRate }: DrawingReviewProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="card-surface p-6">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Draw this on paper or in your head
        </p>
        <div className="mt-2 text-card-body">
          <RichFieldRender field={content.prompt} />
        </div>
      </div>
      <div className="flex justify-center">
        <DrawingRenderer content={content} showModel={revealed} />
      </div>
      {revealed ? (
        <RatingButtons onRate={onRate} />
      ) : (
        <div className="flex justify-center">
          <Button onClick={() => setRevealed(true)}>Show model answer</Button>
        </div>
      )}
    </div>
  );
}
