import type { ReactNode } from "react";

export function PagePlaceholder({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section className="mt-2">
      <h1 className="text-2xl font-semibold tracking-tight text-navy dark:text-gold sm:text-3xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-base text-ink-700 dark:text-ink-300">{subtitle}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}
