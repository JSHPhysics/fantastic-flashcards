import type { ReactNode } from "react";

// Floating action button. Sits above the bottom tab nav with safe-area padding.
export function Fab({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-navy text-cream shadow-lg transition-transform hover:scale-105 active:scale-95"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
      }}
    >
      {children}
    </button>
  );
}
