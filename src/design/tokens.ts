// Design tokens for FantasticFlashcards.
//
// Theme-able tokens are exposed to Tailwind as `rgb(var(--color-X) / <alpha>)`
// so utility classes (`bg-cream`, `text-navy/30`, etc.) resolve to the
// current theme's CSS variables. The default values in :root match the
// original brand palette; alternate themes override these in index.css.
//
// Anything semantic-and-fixed (FSRS rating colours, brand gold/navy) keeps
// its original hex value so the four rating buttons stay visually stable
// no matter which theme is active. Themes that want to lean colourful
// re-tint surfaces + ink instead.

// Hex string for non-theme-aware contexts (manifest, SVG fills, etc.).
export const palette = {
  // Light mode surfaces
  cream: "#FAF7F2",
  surface: "#FFFFFF",
  navy: "#1E3A5F",
  gold: "#C9A14A",

  // Rating colours (used by FSRS buttons + chart accents)
  again: "#C44545",
  hard: "#D4912E",
  good: "#3E8E63",
  easy: "#3D7AB8",

  // Neutral scale
  ink900: "#1A1F2C",
  ink700: "#3A4357",
  ink500: "#6A7287",
  ink300: "#B7BCC8",
  ink100: "#E7E9EE",

  // Dark mode surfaces
  darkBg: "#121821",
  darkSurface: "#1B2330",
  darkInk: "#E9EDF3",
} as const;

// Tailwind colour references — emit the rgb(var(--c) / <alpha>) form so
// utility opacity modifiers like `bg-navy/30` work and any theme can swap
// the underlying value via :root[data-theme=X].
export const themedColors = {
  cream: "rgb(var(--color-cream) / <alpha-value>)",
  surface: "rgb(var(--color-surface) / <alpha-value>)",
  navy: "rgb(var(--color-navy) / <alpha-value>)",
  gold: "rgb(var(--color-gold) / <alpha-value>)",
  again: "rgb(var(--color-again) / <alpha-value>)",
  hard: "rgb(var(--color-hard) / <alpha-value>)",
  good: "rgb(var(--color-good) / <alpha-value>)",
  easy: "rgb(var(--color-easy) / <alpha-value>)",
  "dark-bg": "rgb(var(--color-dark-bg) / <alpha-value>)",
  "dark-surface": "rgb(var(--color-dark-surface) / <alpha-value>)",
  "dark-ink": "rgb(var(--color-dark-ink) / <alpha-value>)",
  ink: {
    900: "rgb(var(--color-ink-900) / <alpha-value>)",
    700: "rgb(var(--color-ink-700) / <alpha-value>)",
    500: "rgb(var(--color-ink-500) / <alpha-value>)",
    300: "rgb(var(--color-ink-300) / <alpha-value>)",
    100: "rgb(var(--color-ink-100) / <alpha-value>)",
  },
} as const;

export const rating = {
  again: palette.again,
  hard: palette.hard,
  good: palette.good,
  easy: palette.easy,
} as const;

export const radius = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
} as const;

export const spacing = {
  // 44pt minimum tap target per Playbook section 11
  tapTarget: "2.75rem",
} as const;

export const motion = {
  // Transitions kept in the 150-200ms band
  fast: "150ms",
  base: "200ms",
} as const;

// Typography scale - generous for card content, tighter for chrome
export const type = {
  fontFamily:
    'var(--font-family, ui-sans-serif), system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    cardBody: "1.5rem", // card-face content
  },
  leading: {
    tight: "1.2",
    body: "1.55",
    cardBody: "1.5",
  },
} as const;

export type Palette = typeof palette;
export type Rating = keyof typeof rating;
