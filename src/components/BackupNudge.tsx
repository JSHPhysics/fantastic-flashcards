// Floating, dismissable toast that suggests backing up when local data has
// drifted from the last backup. Condition (per Playbook 3):
//   profile.lastChangeAt > profile.lastBackupAt
//   AND (now - profile.lastBackupAt) > 20 hours
// Special case: a brand-new profile (lastBackupAt === 0) shows once enough
// edits have accumulated so first-time users see the prompt too.

import { useState } from "react";
import { Link } from "react-router-dom";
import { useProfile } from "../db";
import {
  DAILY_BACKUP_BONUS,
  hasEarnedBackupBonusToday,
} from "../gamification/coins";

const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

export function BackupNudge() {
  const profile = useProfile();
  // Dismissal only sticks for the current page session, per Playbook
  // ("Dismissable. Re-appears next check."). A hard reload re-shows it.
  const [dismissed, setDismissed] = useState(false);

  if (!profile || dismissed) return null;

  const shouldShow = needsBackupNudge(
    profile.lastChangeAt,
    profile.lastBackupAt,
    Date.now(),
  );
  if (!shouldShow) return null;

  // Only dangle the +5 incentive when it's actually claimable today. Once
  // the student has earned it, the nudge falls back to the plain reminder
  // so we're not implying they can earn more for the same day.
  const canEarnBackupBonus = !hasEarnedBackupBonusToday(profile.settings);

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-ink-100 bg-surface px-4 py-3 shadow-lg dark:border-dark-surface dark:bg-dark-surface"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 6.5rem)",
      }}
    >
      <span aria-hidden className="text-xl">
        💾
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium text-ink-900 dark:text-dark-ink">
          Time to back up
        </p>
        <p className="text-xs text-ink-500 dark:text-ink-300">
          Save a copy of your decks so you can restore them on another device
          {canEarnBackupBonus
            ? ` · earn ${DAILY_BACKUP_BONUS} coins today.`
            : "."}
        </p>
      </div>
      <Link
        to="/settings"
        onClick={() => setDismissed(true)}
        className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-3 text-xs font-semibold text-cream hover:bg-navy/90"
      >
        Back up
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="tap-target -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-dark-bg dark:hover:text-dark-ink"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// Exported so tests / Settings can call it without duplicating the logic.
export function needsBackupNudge(
  lastChangeAt: number,
  lastBackupAt: number,
  now: number,
): boolean {
  // Nothing has changed since the last backup -> nothing to nudge about.
  if (lastChangeAt <= lastBackupAt) return false;
  // Never backed up before: nudge once the user's been using the app long
  // enough to accumulate something worth saving (24 hours since lastChangeAt
  // is the only signal we have).
  if (lastBackupAt === 0) {
    return now - lastChangeAt > TWENTY_HOURS_MS;
  }
  return now - lastBackupAt > TWENTY_HOURS_MS;
}
