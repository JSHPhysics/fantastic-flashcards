// Pill showing the number of cards due now/today for a deck (incl. subdecks).
// Hidden when zero. Session 10 hooks this into the real study flow; the
// underlying card.fsrs.due value is already correct from createEmptyCard().

export function DueTodayBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-navy dark:text-gold"
      aria-label={`${count} cards due`}
    >
      {count}
    </span>
  );
}
