// Rank-up popup. Fires once at session end when the student crosses a new
// rank band. Confetti intensity comes from the rank definition; Legend
// gets a gold-only burst plus a "🎉" message.

import { Dialog } from "../Dialog";
import { Button } from "../Button";
import { Confetti } from "./Confetti";
import type { RankInfo } from "../../gamification/ranks";
import { legendMultiplier } from "../../gamification/ranks";
import { useEffect, useState } from "react";

interface RankUpDialogProps {
  rank: RankInfo | null;
  onClose: () => void;
}

export function RankUpDialog({ rank, onClose }: RankUpDialogProps) {
  const [multiplier, setMultiplier] = useState<number>(0);

  // Look up how many decks are at 100% mastery so we can show
  // "Double Legend" or "Triple Legend" prefixes when applicable. Only
  // matters at the Legend tier; cheap to compute regardless.
  useEffect(() => {
    if (!rank || rank.id !== "legend") {
      setMultiplier(0);
      return;
    }
    let cancelled = false;
    legendMultiplier().then((m) => {
      if (!cancelled) setMultiplier(m);
    });
    return () => {
      cancelled = true;
    };
  }, [rank]);

  if (!rank) return null;

  const legendPrefix =
    rank.id === "legend"
      ? multiplier >= 3
        ? "Triple Legend "
        : multiplier >= 2
          ? "Double Legend "
          : ""
      : "";

  return (
    <>
      {rank.confetti > 0 && <Confetti intensity={rank.confetti as 1 | 2 | 3} />}
      <Dialog
        open={true}
        onClose={onClose}
        title={`${legendPrefix}${rank.label} unlocked!`}
        footer={
          <Button onClick={onClose} variant="primary">
            Keep going
          </Button>
        }
      >
        <div className="space-y-3 text-center">
          <div className="text-6xl" aria-hidden>
            {rank.icon}
          </div>
          <p className="text-base text-ink-900 dark:text-dark-ink">
            {rank.message}
          </p>
          {rank.id === "legend" && multiplier >= 2 && (
            <p className="text-sm text-ink-500 dark:text-ink-300">
              {multiplier} decks at 100% mastery. Phenomenal.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
