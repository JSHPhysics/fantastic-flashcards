// Coin balance pill. Used in shop headers and on the Stats screen so the
// student can see their balance at a glance.

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

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-gold/20 ${padding} font-semibold text-navy dark:text-gold`}
      aria-label={`${coins} coins`}
    >
      <span aria-hidden>🪙</span>
      <span>{coins}</span>
      {showRemaining && (
        <span className="ml-1 text-ink-500 dark:text-ink-300 font-normal">
          ({remaining} left today)
        </span>
      )}
    </span>
  );
}
