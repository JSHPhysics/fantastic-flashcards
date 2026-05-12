// Theme catalogue.
//
// Themes are applied by setting document.documentElement.dataset.theme to
// the theme's id. The actual CSS variables are defined in src/index.css
// under :root[data-theme="<id>"] rules; this file is the metadata layer
// the UI uses for the shop, settings, and theme manager.
//
// Premium themes own their full light-or-dark palette via CSS variables —
// the theme manager does NOT toggle the `.dark` Tailwind class when a
// premium theme is active, because the theme's CSS variables already
// express its "darkness" directly. The legacy themeMode (light/dark/system)
// only matters when no premium theme is selected.

export type ThemeKind = "light" | "dark";

export type ThemeCategory =
  | "free"
  | "purchasable"
  | "subject" // unlocked via code, bundled with a font in TEAM* codes
  | "default-light"
  | "default-dark";

export interface ThemeDefinition {
  id: string;
  name: string;
  kind: ThemeKind;
  category: ThemeCategory;
  // Cost in coins. 0 for free + subject themes.
  cost: number;
  // Three colour swatches for the shop preview.
  // Format: hex strings so the swatch JSX doesn't have to compute rgb().
  swatches: [string, string, string];
}

// "Default" entries map the legacy light/dark themes (no data-theme attr)
// so the shop can offer them as the starting choice and show their
// swatches like everything else.
export const DEFAULT_LIGHT: ThemeDefinition = {
  id: "default-light",
  name: "Default light",
  kind: "light",
  category: "default-light",
  cost: 0,
  swatches: ["#FAF7F2", "#1E3A5F", "#C9A14A"],
};

export const DEFAULT_DARK: ThemeDefinition = {
  id: "default-dark",
  name: "Default dark",
  kind: "dark",
  category: "default-dark",
  cost: 0,
  swatches: ["#121821", "#6482C8", "#DEBC6E"],
};

export const FREE_THEMES: ThemeDefinition[] = [
  {
    id: "slate",
    name: "Slate",
    kind: "light",
    category: "free",
    cost: 0,
    swatches: ["#F0F2F7", "#2D5082", "#C89B46"],
  },
  {
    id: "warm",
    name: "Warm",
    kind: "light",
    category: "free",
    cost: 0,
    swatches: ["#FCF6E8", "#824623", "#C88232"],
  },
  {
    id: "lavender",
    name: "Lavender",
    kind: "light",
    category: "free",
    cost: 0,
    swatches: ["#F5F0FF", "#5F41A5", "#B46EC8"],
  },
  {
    id: "midnight",
    name: "Midnight",
    kind: "dark",
    category: "free",
    cost: 0,
    swatches: ["#0C0F18", "#82A0E6", "#EBC878"],
  },
  {
    id: "graphite",
    name: "Graphite",
    kind: "dark",
    category: "free",
    cost: 0,
    swatches: ["#16181C", "#A5AFC3", "#DCC882"],
  },
  {
    id: "forest",
    name: "Forest",
    kind: "dark",
    category: "free",
    cost: 0,
    swatches: ["#0F1C16", "#82C8A0", "#D7B96E"],
  },
];

export const PURCHASABLE_THEMES: ThemeDefinition[] = [
  {
    id: "ocean",
    name: "Ocean",
    kind: "light",
    category: "purchasable",
    cost: 100,
    swatches: ["#E8F6FA", "#0F5F8C", "#2EC4B6"],
  },
  {
    id: "sunset",
    name: "Sunset",
    kind: "light",
    category: "purchasable",
    cost: 100,
    swatches: ["#FFF0E6", "#C8463C", "#EB913C"],
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    kind: "light",
    category: "purchasable",
    cost: 200,
    swatches: ["#FFF0F6", "#C34682", "#E691AF"],
  },
  {
    id: "volcanic",
    name: "Volcanic",
    kind: "dark",
    category: "purchasable",
    cost: 200,
    swatches: ["#160E0E", "#EB5A4B", "#F59B5A"],
  },
  {
    id: "arctic",
    name: "Arctic",
    kind: "light",
    category: "purchasable",
    cost: 300,
    swatches: ["#EBF4FC", "#2D6EAF", "#6EAFD7"],
  },
  {
    id: "neon",
    name: "Neon",
    kind: "dark",
    category: "purchasable",
    cost: 300,
    swatches: ["#0C0C16", "#00E6EB", "#EB50C8"],
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    kind: "light",
    category: "purchasable",
    cost: 400,
    swatches: ["#FCF0EB", "#A55550", "#DC9182"],
  },
  {
    id: "amethyst",
    name: "Amethyst",
    kind: "dark",
    category: "purchasable",
    cost: 400,
    swatches: ["#160E24", "#C391F0", "#EBAFD7"],
  },
];

export const SUBJECT_THEMES: ThemeDefinition[] = [
  {
    id: "cs-light",
    name: "CS Terminal Light",
    kind: "light",
    category: "subject",
    cost: 0,
    swatches: ["#F5F5F5", "#1E6E32", "#DC6E1E"],
  },
  {
    id: "cs-dark",
    name: "CS Terminal Dark",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#080C08", "#50F078", "#F5B450"],
  },
  {
    id: "chem-light",
    name: "Chem Lab Light",
    kind: "light",
    category: "subject",
    cost: 0,
    swatches: ["#EBF8F5", "#23786E", "#C88C3C"],
  },
  {
    id: "chem-dark",
    name: "Chem Lab Dark",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#08120F", "#50DCC3", "#DCA55F"],
  },
  {
    id: "bio-light",
    name: "Bio Specimen Light",
    kind: "light",
    category: "subject",
    cost: 0,
    swatches: ["#F0F7EA", "#4B8232", "#C89B46"],
  },
  {
    id: "bio-dark",
    name: "Bio Specimen Dark",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#0E160C", "#91D769", "#E1C36E"],
  },
  {
    id: "classics-light",
    name: "Classics Papyrus Light",
    kind: "light",
    category: "subject",
    cost: 0,
    swatches: ["#FAF0DA", "#824B28", "#BE914B"],
  },
  {
    id: "classics-dark",
    name: "Classics Papyrus Dark",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#16100C", "#DCA064", "#F5C382"],
  },
  {
    id: "physics-oscilloscope",
    name: "Physics Oscilloscope",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#041210", "#50F0DC", "#EBC850"],
  },
  {
    id: "physics-signal",
    name: "Physics Signal",
    kind: "dark",
    category: "subject",
    cost: 0,
    swatches: ["#080812", "#82AAFF", "#EB915A"],
  },
];

export const ALL_THEMES: ThemeDefinition[] = [
  DEFAULT_LIGHT,
  DEFAULT_DARK,
  ...FREE_THEMES,
  ...PURCHASABLE_THEMES,
  ...SUBJECT_THEMES,
];

export function getTheme(id: string | undefined): ThemeDefinition | undefined {
  if (!id) return undefined;
  return ALL_THEMES.find((t) => t.id === id);
}

// Subject themes are hidden in the shop until unlocked — keeps the
// catalogue feeling tidy for the average student.
export function isSubjectTheme(t: ThemeDefinition): boolean {
  return t.category === "subject";
}

// "Owned" = available without spending coins. Free themes are always owned;
// purchasable themes are owned once they're in the user's unlocked list;
// subject themes are owned only after the corresponding code is redeemed.
export function isOwned(
  theme: ThemeDefinition,
  unlocked: readonly string[] | undefined,
): boolean {
  if (theme.cost === 0 && theme.category !== "subject") return true;
  if (theme.category === "default-light" || theme.category === "default-dark") {
    return true;
  }
  return (unlocked ?? []).includes(theme.id);
}
