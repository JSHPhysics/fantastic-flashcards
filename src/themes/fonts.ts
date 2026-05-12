// Font catalogue + Google Fonts loader.
//
// Fonts are loaded on demand: when the user picks one, ensureFontLoaded
// injects a <link rel="stylesheet"> into <head> if it isn't already there.
// font-display: swap is set via the Google Fonts URL param so the page
// stays usable while the font downloads.
//
// Codes in the spec (e.g. FN2K7T) unlock individual fonts. They're
// catalogued here for the redeem-code module to consume.

export interface FontDefinition {
  id: string;
  name: string;
  // CSS font-family stack with quoted family + system fallbacks.
  stack: string;
  // Google Fonts URL fragment, e.g. "Inter:wght@400;600;700".
  // Omitted for the system stack.
  googleFontsFamily?: string;
  // Short tag for the shop ("Clean", "Friendly", etc.).
  description: string;
}

export const SYSTEM_FONT: FontDefinition = {
  id: "system",
  name: "System UI",
  stack:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"',
  description: "Default — uses your device's font.",
};

export const FONTS: FontDefinition[] = [
  SYSTEM_FONT,
  {
    id: "inter",
    name: "Inter",
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Inter:wght@400;500;600;700",
    description: "Clean, professional.",
  },
  {
    id: "poppins",
    name: "Poppins",
    stack: '"Poppins", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Poppins:wght@400;500;600;700",
    description: "Friendly geometric.",
  },
  {
    id: "nunito",
    name: "Nunito",
    stack: '"Nunito", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Nunito:wght@400;600;700",
    description: "Rounded, approachable.",
  },
  {
    id: "raleway",
    name: "Raleway",
    stack: '"Raleway", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Raleway:wght@300;400;600;700",
    description: "Elegant, thin.",
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    stack: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "DM+Sans:wght@400;500;700",
    description: "Modern, readable.",
  },
  {
    id: "playfair",
    name: "Playfair Display",
    stack: '"Playfair Display", ui-serif, Georgia, serif',
    googleFontsFamily: "Playfair+Display:wght@400;600;700",
    description: "Elegant serif.",
  },
  {
    id: "space-mono",
    name: "Space Mono",
    stack: '"Space Mono", ui-monospace, "Cascadia Mono", "Menlo", monospace',
    googleFontsFamily: "Space+Mono:wght@400;700",
    description: "Monospace, technical.",
  },
  {
    id: "merriweather",
    name: "Merriweather",
    stack: '"Merriweather", ui-serif, Georgia, serif',
    googleFontsFamily: "Merriweather:wght@400;700",
    description: "Readable serif.",
  },
  {
    id: "concert-one",
    name: "Concert One",
    stack: '"Concert One", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Concert+One",
    description: "Display, bold.",
  },
  {
    id: "schoolbell",
    name: "Schoolbell",
    stack: '"Schoolbell", "Comic Sans MS", cursive',
    googleFontsFamily: "Schoolbell",
    description: "Handwritten, casual.",
  },
  {
    id: "chewy",
    name: "Chewy",
    stack: '"Chewy", "Comic Sans MS", cursive',
    googleFontsFamily: "Chewy",
    description: "Playful, bubbly.",
  },
  {
    id: "indie-flower",
    name: "Indie Flower",
    stack: '"Indie Flower", "Comic Sans MS", cursive',
    googleFontsFamily: "Indie+Flower",
    description: "Handwritten, friendly.",
  },
  {
    id: "pacifico",
    name: "Pacifico",
    stack: '"Pacifico", cursive',
    googleFontsFamily: "Pacifico",
    description: "Retro, rounded.",
  },
  // Subject-team fonts. Unlocked only via TEAM* bundle codes — kept here so
  // the catalogue is a single source of truth and the unlock module can
  // reference them.
  {
    id: "share-tech-mono",
    name: "Share Tech Mono",
    stack: '"Share Tech Mono", ui-monospace, monospace',
    googleFontsFamily: "Share+Tech+Mono",
    description: "CS / Physics team — monospace, terminal.",
  },
  {
    id: "rajdhani",
    name: "Rajdhani",
    stack: '"Rajdhani", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Rajdhani:wght@400;500;600;700",
    description: "Chem team — angular technical.",
  },
  {
    id: "comfortaa",
    name: "Comfortaa",
    stack: '"Comfortaa", ui-sans-serif, system-ui, sans-serif',
    googleFontsFamily: "Comfortaa:wght@400;500;600;700",
    description: "Bio team — rounded soft.",
  },
  {
    id: "cinzel",
    name: "Cinzel",
    stack: '"Cinzel", ui-serif, Georgia, serif',
    googleFontsFamily: "Cinzel:wght@400;500;600;700",
    description: "Classics team — Roman capitals.",
  },
];

export function getFont(id: string | undefined): FontDefinition | undefined {
  if (!id) return undefined;
  return FONTS.find((f) => f.id === id);
}

const loadedFamilies = new Set<string>();

// Idempotent: appends a <link> to <head> on first call, no-op on later
// calls for the same family. Safe to call repeatedly when the user
// switches fonts.
export function ensureFontLoaded(font: FontDefinition): void {
  if (!font.googleFontsFamily) return;
  if (loadedFamilies.has(font.googleFontsFamily)) return;
  loadedFamilies.add(font.googleFontsFamily);

  // Preconnect once for performance.
  if (!document.querySelector('link[data-ff-preconnect="fonts"]')) {
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    pre1.dataset.ffPreconnect = "fonts";
    document.head.appendChild(pre1);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    pre2.dataset.ffPreconnect = "fonts";
    document.head.appendChild(pre2);
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFontsFamily}&display=swap`;
  link.dataset.ffFont = font.id;
  document.head.appendChild(link);
}

// "Owned" — same shape as themes. System font is always available.
export function isFontOwned(
  font: FontDefinition,
  unlocked: readonly string[] | undefined,
): boolean {
  if (font.id === "system") return true;
  return (unlocked ?? []).includes(font.id);
}
