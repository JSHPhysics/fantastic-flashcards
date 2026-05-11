// Suggests adding to Home Screen on iOS / iPadOS Safari. Apple's PWA model
// requires this step manually - there's no install prompt event - so a
// gentle hint is the only way to surface the feature.
//
// Hidden once dismissed (persistent across reloads via localStorage) and
// auto-hidden when the app is already running standalone.

import { useEffect, useState } from "react";

const DISMISS_KEY = "ff_install_tip_dismissed";

export function InstallTipBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode may refuse localStorage; banner just won't persist.
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 z-30 mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-ink-100 bg-surface px-4 py-3 shadow-lg dark:border-dark-surface dark:bg-dark-surface"
      style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
    >
      <span aria-hidden className="mt-0.5 text-xl">
        📲
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium text-ink-900 dark:text-dark-ink">
          Add to your home screen
        </p>
        <p className="text-xs text-ink-500 dark:text-ink-300">
          Tap the Share button, then "Add to Home Screen" to open the app full
          screen and keep your data on this device.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss install hint"
        onClick={dismiss}
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

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua);
  // iOS Chrome / Firefox / Edge all use WebKit; rule them out by their UA
  // tags so the banner only shows when the user can actually "Add to Home
  // Screen" via the share menu.
  const otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && !otherBrowser;
}

function isStandalone(): boolean {
  // iOS exposes navigator.standalone; everything else uses the
  // display-mode media query.
  const navStandalone = (
    navigator as Navigator & { standalone?: boolean }
  ).standalone;
  if (navStandalone) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}
