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

  const containerClass =
    variant === "sheet"
      ? "fixed inset-x-0 bottom-0 w-full sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl"
      : "fixed inset-x-4 top-[10vh] mx-auto w-auto max-w-md rounded-2xl sm:inset-x-0";

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
        className={`${containerClass} relative z-10 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl pb-[max(env(safe-area-inset-bottom),1.25rem)] dark:bg-dark-surface`}
      >
        <header className="mb-4 flex items-start justify-between gap-4">
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
        <div>{children}</div>
        {footer && (
          <footer className="mt-6 flex flex-wrap justify-end gap-2">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
