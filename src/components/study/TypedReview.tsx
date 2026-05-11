import { useState } from "react";
import type { Rating, TypedContent } from "../../db";
import { RichFieldRender } from "../media/RichFieldPreview";
import { Button } from "../Button";
import { compareTypedAnswer } from "../../study/typedMatcher";

interface TypedReviewProps {
  content: TypedContent;
  onRate: (rating: Rating) => void;
}

// Typed flow per Playbook 7: submit -> compare -> show diff -> Continue.
// Rating is inferred from the match: exact = Good, close = Hard, else Again.

export function TypedReview({ content, onRate }: TypedReviewProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof compareTypedAnswer> | null>(null);

  const submit = () => {
    if (!value.trim() || submitted) return;
    const r = compareTypedAnswer(value, content);
    setResult(r);
    setSubmitted(true);
  };

  const handleContinue = () => {
    if (!result) return;
    onRate(result.rating);
  };

  return (
    <div className="space-y-4">
      <div className="card-surface p-6">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Type your answer
        </p>
        <div className="mt-2 text-card-body">
          <RichFieldRender field={content.prompt} />
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-2"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitted}
          className="w-full rounded-xl border border-ink-300 bg-surface px-4 py-3 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
        />
        {!submitted && (
          <div className="flex justify-center">
            <Button type="submit" disabled={!value.trim()}>
              Submit
            </Button>
          </div>
        )}
      </form>
      {submitted && result && (
        <>
          <ResultPanel
            result={result}
            content={content}
            studentInput={value}
          />
          <div className="flex justify-center">
            <Button onClick={handleContinue}>Continue</Button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultPanel({
  result,
  content,
  studentInput,
}: {
  result: ReturnType<typeof compareTypedAnswer>;
  content: TypedContent;
  studentInput: string;
}) {
  const tone =
    result.rating === 3
      ? "good"
      : result.rating === 2
        ? "hard"
        : "again";
  const heading =
    result.rating === 3
      ? "Correct"
      : result.rating === 2
        ? "Almost - off by a couple of characters"
        : "Not quite";
  const colorClass =
    tone === "good"
      ? "border-good/40 bg-good/10 text-good"
      : tone === "hard"
        ? "border-hard/40 bg-hard/10 text-hard"
        : "border-again/40 bg-again/10 text-again";

  return (
    <div className={`rounded-xl border-2 p-4 ${colorClass}`}>
      <p className="font-semibold">{heading}</p>
      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70">You typed</p>
          <p className="mt-0.5 break-words text-base">{studentInput || "(blank)"}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider opacity-70">
            {result.matchedAnswer ? "Matched" : "Closest accepted"}
          </p>
          <p className="mt-0.5 break-words text-base">
            {result.matchedAnswer ?? result.closest ?? content.acceptedAnswers[0]}
          </p>
        </div>
      </div>
      {content.acceptedAnswers.length > 1 && (
        <p className="mt-2 text-xs opacity-80">
          Other accepted answers: {content.acceptedAnswers
            .filter(
              (a) =>
                a !== (result.matchedAnswer ?? result.closest),
            )
            .join(", ")}
        </p>
      )}
    </div>
  );
}
