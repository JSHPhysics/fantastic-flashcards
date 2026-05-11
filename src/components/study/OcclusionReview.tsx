import { useState } from "react";
import type { OcclusionContent, Rating } from "../../db";
import { OcclusionRenderer } from "../cards/occlusion/OcclusionRenderer";
import { RatingButtons } from "./RatingButtons";
import { Button } from "../Button";

interface OcclusionReviewProps {
  content: OcclusionContent;
  onRate: (rating: Rating) => void;
}

export function OcclusionReview({ content, onRate }: OcclusionReviewProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-4">
      <div className="card-surface flex flex-col items-center p-4">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          {content.mode === "hide-all"
            ? "Reveal each part one at a time"
            : "What's covered?"}
        </p>
        <div className="mt-3 flex justify-center">
          <OcclusionRenderer
            content={content}
            state={revealed ? "revealed" : "hidden"}
            onReveal={() => setRevealed(true)}
          />
        </div>
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
