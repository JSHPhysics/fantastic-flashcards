import type { Config } from "tailwindcss";
import { palette, radius, spacing, type as typography } from "./src/design/tokens";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        cream: palette.cream,
        surface: palette.surface,
        navy: palette.navy,
        gold: palette.gold,
        again: palette.again,
        hard: palette.hard,
        good: palette.good,
        easy: palette.easy,
        ink: {
          900: palette.ink900,
          700: palette.ink700,
          500: palette.ink500,
          300: palette.ink300,
          100: palette.ink100,
        },
        "dark-bg": palette.darkBg,
        "dark-surface": palette.darkSurface,
        "dark-ink": palette.darkInk,
      },
      borderRadius: radius,
      spacing: {
        tap: spacing.tapTarget,
      },
      fontFamily: {
        sans: [typography.fontFamily],
      },
      fontSize: {
        "card-body": [
          typography.size.cardBody,
          { lineHeight: typography.leading.cardBody },
        ],
      },
    },
  },
  plugins: [],
};

export default config;
