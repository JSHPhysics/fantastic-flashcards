import { useMemo, useState } from "react";
import type { McqContent, McqOption, Rating } from "../../db";
import { RichFieldRender } from "../media/RichFieldPreview";
import { Button } from "../Button";

interface McqReviewProps {
  content: McqContent;
  onRate: (rating: Rating) => void;
}

// MCQ flow per Playbook 7: tap an option, see green/red feedback, Continue.
// Rating is inferred: correct first try -> Good (3), wrong -> Again (1).

export function McqReview({ content, onRate }: McqReviewProps) {
  const [picked, setPicked] = useState<string | null>(null);

  const options = useMemo<McqOption[]>(() => {
    if (!content.shuffleOptions) return content.options;
    return shuffled(content.options);
  }, [content]);

  const pickedOption = picked
    ? content.options.find((o) => o.id === picked)
    : undefined;

  const handleContinue = () => {
    if (!pickedOption) return;
    onRate(pickedOption.correct ? 3 : 1);
  };

  return (
    <div className="space-y-4">
      <div className="card-surface p-6">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Pick the correct answer
        </p>
        <div className="mt-2 text-card-body">
          <RichFieldRender field={content.question} />
        </div>
      </div>
      <ul className="space-y-2">
        {options.map((opt, idx) => {
          const isPicked = opt.id === picked;
          const showFeedback = picked !== null;
          let stateClass =
            "border-ink-200 bg-surface hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-surface dark:hover:bg-dark-bg";
          if (showFeedback) {
            if (opt.correct) stateClass = "border-good/40 bg-good/15 text-good";
            else if (isPicked) stateClass = "border-again/40 bg-again/15 text-again";
            else stateClass =
              "border-ink-200 bg-surface text-ink-500 dark:border-dark-surface dark:bg-dark-surface";
          }
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={picked !== null}
                onClick={() => setPicked(opt.id)}
                className={`tap-target flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left text-base transition-colors ${stateClass}`}
              >
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700 dark:bg-dark-bg dark:text-ink-300">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{opt.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {picked && (
        <div className="flex justify-center">
          <Button onClick={handleContinue}>Continue</Button>
        </div>
      )}
    </div>
  );
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
