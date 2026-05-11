// Notifies the user when a new service-worker version is ready so they can
// reload deliberately. Without this, the user could be in the middle of a
// study session when the worker swaps in updated assets - a deferred prompt
// is friendlier.

import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn("[pwa] SW registration error", error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-ink-100 bg-surface px-4 py-3 shadow-lg dark:border-dark-surface dark:bg-dark-surface"
      style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
    >
      <span aria-hidden className="text-xl">
        ⬆️
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium text-ink-900 dark:text-dark-ink">
          A new version is ready
        </p>
        <p className="text-xs text-ink-500 dark:text-ink-300">
          Reload when you're between sessions to pick it up.
        </p>
      </div>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-3 text-xs font-semibold text-cream hover:bg-navy/90"
      >
        Reload
      </button>
      <button
        type="button"
        aria-label="Dismiss update"
        onClick={() => setNeedRefresh(false)}
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
