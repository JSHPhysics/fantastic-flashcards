import type { Config } from "tailwindcss";
import { radius, spacing, themedColors, type as typography } from "./src/design/tokens";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // Theme-aware palette: each token resolves to a CSS variable in the
      // rgb(<r g b> / <alpha>) form, so opacity modifiers (`bg-navy/30`)
      // keep working and any theme can override the value via :root
      // [data-theme=X] in index.css.
      colors: themedColors,
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
