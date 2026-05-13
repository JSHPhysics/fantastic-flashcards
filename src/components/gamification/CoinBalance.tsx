// Coin balance pill. Used in shop headers and on the Stats screen so the
// student can see their balance at a glance.
//
// The icon is a custom three-coin SVG pile, not the 🪙 emoji. Apple's
// emoji renders as a flat silver-ish disc that reads more like a moon
// than a coin at small sizes; the SVG also lets us re-tint with theme
// colours instead of being locked to the system emoji palette.

import { useProfile } from "../../db";
import { coinsRemainingToday } from "../../gamification/coins";

interface CoinBalanceProps {
  size?: "sm" | "md";
  showRemaining?: boolean;
}

export function CoinBalance({ size = "md", showRemaining = false }: CoinBalanceProps) {
  const profile = useProfile();
  const coins = profile?.settings.coins ?? 0;
  const remaining = coinsRemainingToday(profile?.settings);

  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gold/20 ${padding} font-semibold text-navy dark:text-gold`}
      aria-label={`${coins} coins`}
    >
      <CoinPileIcon className={iconSize} />
      <span>{coins}</span>
      {showRemaining && (
        <span className="ml-1 text-ink-500 dark:text-ink-300 font-normal">
          ({remaining} left today)
        </span>
      )}
    </span>
  );
}

// Three gold coins stacked in a triangle — two on the bottom row, one
// perched on top with a small star to make it read clearly as "money"
// rather than just three circles. Fixed gold tones (not theme variables)
// so the pile stays recognisable in every theme including dark ones,
// where the surrounding pill background is already gold-tinted.
function CoinPileIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Bottom row, drawn first so the front coin overlaps them. */}
      <Coin cx={6.5} cy={15.5} r={5} />
      <Coin cx={17.5} cy={15.5} r={5} />
      {/* Front coin: slightly bigger + a star inside. */}
      <Coin cx={12} cy={8.5} r={5.5} highlight />
    </svg>
  );
}

function Coin({
  cx,
  cy,
  r,
  highlight,
}: {
  cx: number;
  cy: number;
  r: number;
  highlight?: boolean;
}) {
  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#E5B43A"
        stroke="#7A5A1C"
        strokeWidth={0.7}
      />
      {/* Inner ring to break up the disc visually so it doesn't read as a
          flat moon or button. */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 1.4}
        fill="none"
        stroke="#7A5A1C"
        strokeWidth={0.35}
        opacity={0.55}
      />
      {/* Star sits in the front-most coin only — keeps the pile from
          looking too busy. */}
      {highlight && (
        <path
          d="M0,-2.4 L0.74,-0.74 L2.4,-0.74 L1.06,0.28 L1.55,2 L0,0.95 L-1.55,2 L-1.06,0.28 L-2.4,-0.74 L-0.74,-0.74 Z"
          transform={`translate(${cx} ${cy})`}
          fill="#FCE48A"
          stroke="#7A5A1C"
          strokeWidth={0.3}
          strokeLinejoin="round"
        />
      )}
    </>
  );
}
