import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Minimal accessible dialog. Focus-trapped to its content while open;
// Escape closes; clicking the scrim closes. We don't pull in a UI library.

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  // 'sheet' slides up from the bottom on small screens; 'centered' is centered
  // on every breakpoint. Both render as portals into document.body.
  variant?: "sheet" | "centered";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "centered",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  // Container holds the dialog at a known max-height with a flex column
  // layout. Header pinned at top, body fills + scrolls, footer pinned at
  // bottom — that's what makes the action buttons reachable even when the
  // body content overflows (e.g. CreateDeck in iPad landscape with the
  // keyboard up).
  //
  // Heights use dvh (dynamic viewport height) so iOS Safari's on-screen
  // keyboard shrinks the dialog's usable height instead of pushing the
  // footer off-screen. Falls back to vh on older browsers.
  const containerClass =
    variant === "sheet"
      ? "fixed inset-x-0 bottom-0 w-full sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl"
      : "fixed inset-x-4 top-[5dvh] mx-auto w-auto max-w-md rounded-2xl sm:inset-x-0 sm:top-[8dvh]";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby={description ? "dialog-description" : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={`${containerClass} relative z-10 flex max-h-[90dvh] flex-col rounded-t-2xl bg-surface shadow-xl dark:bg-dark-surface`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
          <div>
            <h2 id="dialog-title" className="text-lg font-semibold text-ink-900 dark:text-dark-ink">
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
            className="tap-target -mr-2 -mt-2 inline-flex items-center justify-center rounded-full text-ink-500 hover:text-ink-900 dark:hover:text-dark-ink"
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
        {/* Body is the only scrolling region so the header + footer stay
            pinned. Important on short viewports (iPad landscape with
            keyboard up) where the form would otherwise push the action
            buttons off-screen. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 px-5 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] dark:border-dark-bg">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
