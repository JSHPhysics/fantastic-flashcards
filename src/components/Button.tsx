import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-navy text-cream hover:bg-navy/90 active:bg-navy/80 disabled:bg-ink-300 disabled:text-ink-500",
  secondary:
    "border border-ink-300 bg-surface text-navy hover:bg-ink-100 dark:bg-dark-surface dark:text-gold dark:border-dark-surface dark:hover:bg-dark-surface/70",
  ghost:
    "bg-transparent text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-dark-surface",
  danger:
    "bg-again text-cream hover:bg-again/90 active:bg-again/80",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-3 text-xs h-9 min-h-[2.25rem]",
  md: "tap-target px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {children}
    </button>
  );
}
