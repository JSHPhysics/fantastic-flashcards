import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Accessible dialog with predictable cross-device layout.
//
// Layout strategy
// ---------------
// The dialog uses *flexbox flow* (not `position: fixed`) inside an overlay
// that covers the viewport. The previous version mixed a fixed-positioned
// inner div with a flex outer container — the flex alignment classes did
// nothing because `position: fixed` removes the element from flex flow,
// so positioning collapsed into per-variant top/inset math that diverged
// across Android Chrome, iOS Safari, and desktop. With flex flow the
// dialog's position is entirely determined by the parent's `items-*` /
// `justify-*` classes, which is consistent everywhere.
//
// Device behaviour
// ----------------
// - Phones (< sm, 640px): dialog is a bottom-sheet. Full width, anchored
//   to the bottom edge, rounded top corners only, footer respects the
//   safe-area inset for the iOS home indicator.
// - Tablet portrait + desktop (sm+): dialog centred in viewport with 16px
//   breathing room around it, fully rounded, capped at `size`'s max-width.
//
// Heights use `dvh` (dynamic viewport height) so iOS Safari and Android
// Chrome shrink the dialog's max height when the on-screen keyboard is
// up. Older browsers fall back to layout height — acceptable in practice
// since the body is independently scrollable.
//
// Variants
// --------
// `variant` is kept for API compatibility but no longer changes the
// layout — both "sheet" and "centered" render the same responsive
// bottom-sheet-on-mobile / centred-on-desktop pattern, because that's
// what every dialog actually wants in 2025.

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "sheet" | "centered";
  // Caps the dialog's max width on sm+ breakpoints. Defaults to "sm"
  // (max-w-md, 28rem / 448px). Use "md" for forms with more fields and
  // "lg" for content-heavy dialogs (the theme + font shop, the rank
  // ladder). On phones the dialog is always full-width regardless.
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "sm:max-w-md", // 28rem / 448px
  md: "sm:max-w-lg", // 32rem / 512px
  lg: "sm:max-w-2xl", // 42rem / 672px
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "sm",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus management — first focusable element gets focus on open,
  // previous focus is restored on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusable = node?.querySelectorAll<HTMLElement>(
      "input, textarea, button, select, a[href], [tabindex]:not([tabindex='-1'])",
    );
    focusable?.[0]?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, [open]);

  // Body scroll lock while open. Without this, scrolling inside a dialog
  // can leak to the page underneath on iOS.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      className="fixed inset-0 z-50"
    >
      {/* Scrim — clickable to close, sits underneath the dialog. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Positioning layer — flexbox decides where the dialog sits.
          Modal floats with breathing room on every device: 12px gutters
          + 16px (sm+) bottom inset on phones; 16px around on sm+. The
          earlier bottom-sheet style touched the screen edge which looked
          rough on phones, especially next to the bottom tab bar. */}
      <div className="absolute inset-0 flex items-end justify-center px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          // Width: full on phones, capped at size's max-width from sm up.
          // Height: capped at 90dvh; body scrolls if content overflows.
          // Rounded all corners since the modal floats above the screen
          // edge now rather than docking to the bottom.
          // overscroll-contain prevents iOS rubber-band scrolling out of
          // the body section into the page underneath.
          className={`relative flex w-full max-h-[90dvh] flex-col overflow-hidden rounded-2xl bg-surface shadow-xl dark:bg-dark-surface ${SIZE_CLASS[size]}`}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
            <div className="min-w-0">
              <h2
                id="dialog-title"
                className="text-lg font-semibold text-ink-900 dark:text-dark-ink"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="dialog-description"
                  className="mt-1 text-sm text-ink-500 dark:text-ink-300"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="tap-target -mr-2 -mt-2 inline-flex shrink-0 items-center justify-center rounded-full text-ink-500 hover:text-ink-900 dark:hover:text-dark-ink"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </header>
          {/* Body is the only scrolling region so header + footer stay pinned. */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {children}
          </div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-5 dark:border-dark-bg">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
