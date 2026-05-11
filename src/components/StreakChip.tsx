// Small pill showing a streak length. Hidden when streak is 0 so a fresh
// deck stays uncluttered.
//
// `tone` lets callers differentiate: deck-row streak chips are subtle,
// the global header streak is bolder.
//
// Emojis are reserved for stats displays per project guidelines; the flame
// is a stats convention students recognise instantly.

export function StreakChip({
  days,
  tone = "subtle",
}: {
  days: number;
  tone?: "subtle" | "bold";
}) {
  if (days <= 0) return null;
  const className =
    tone === "bold"
      ? "inline-flex items-center gap-1.5 rounded-full bg-gold/25 px-3 py-1 text-sm font-semibold text-navy dark:text-gold"
      : "inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-navy dark:text-gold";
  return (
    <span
      className={className}
      aria-label={`Streak: ${days} day${days === 1 ? "" : "s"} in a row`}
    >
      <span aria-hidden>🔥</span>
      <span>
        {days}
        <span className="ml-0.5">day{days === 1 ? "" : "s"}</span>
      </span>
    </span>
  );
}
