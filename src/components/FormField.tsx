import type { ReactNode } from "react";

// Shared label + optional hint + slot wrapper for editor fields.
// Keeps card forms visually consistent and accessible.

export function FormField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-ink-900 dark:text-dark-ink"
      >
        {label}
      </label>
      {hint && (
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">{hint}</p>
      )}
      <div className="mt-1">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink";

export const textareaClass = `${inputClass} resize-y min-h-[5rem]`;
