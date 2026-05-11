// Design tokens for FantasticFlashcards.
// Palette and type scale per Playbook section 11.
// Tailwind config consumes these so Tailwind classes match the values used in TS.

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
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"',
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
