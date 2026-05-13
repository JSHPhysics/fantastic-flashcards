// Secret unlock codes (per spec §5).
//
// Codes are case-insensitive, whitespace-trimmed, and idempotent — redeeming
// the same code twice returns success silently with no DB write. The set of
// already-redeemed codes is stored in settings.unlockedCodes so the panel
// can show a history.
//
// Categories:
//  - theme:    unlock one theme
//  - font:     unlock one font
//  - team:     bundle that unlocks two themes + one font (subject codes)
//  - master:   everything (themes + fonts)
//  - debug:    development-only cheats (coins, wipe, verbose log)
//  - staff:    opens the staff-room reference panel (no item unlock)

import { db } from "../db/schema";
import { bumpVersion } from "../db/profile";
import { setCoinBalance } from "./coins";
import { ALL_THEMES } from "../themes/catalogue";
import { FONTS } from "../themes/fonts";

export type CodeCategory =
  | "theme"
  | "font"
  | "team"
  | "master"
  | "staff"
  | "debug";

interface CodeDef {
  category: CodeCategory;
  description: string;
  // For theme/font: which ids to add to unlocked lists.
  themeIds?: string[];
  fontIds?: string[];
  // For master: just a marker; the redeem flow inflates to "all".
  master?: boolean;
  // For debug: a side-effect tag the redeem flow handles.
  debugAction?: "coinmax" | "resetall" | "debugmode";
  // For staff: marker that opens the reference panel.
  staff?: boolean;
}

export const CODES: Record<string, CodeDef> = {
  // ---- Theme codes ----
  TH7X2Q: { category: "theme", description: "Ocean theme", themeIds: ["ocean"] },
  TH4K9W: { category: "theme", description: "Sunset theme", themeIds: ["sunset"] },
  TH3M1P: {
    category: "theme",
    description: "Cherry Blossom theme",
    themeIds: ["cherry-blossom"],
  },
  TH8J5N: { category: "theme", description: "Volcanic theme", themeIds: ["volcanic"] },
  TH2R6Y: { category: "theme", description: "Arctic theme", themeIds: ["arctic"] },
  TH5V0D: { category: "theme", description: "Neon theme", themeIds: ["neon"] },
  TH9L3F: {
    category: "theme",
    description: "Rose Gold theme",
    themeIds: ["rose-gold"],
  },
  TH6B8E: { category: "theme", description: "Amethyst theme", themeIds: ["amethyst"] },

  // ---- Font codes ----
  FN2K7T: { category: "font", description: "Inter font", fontIds: ["inter"] },
  FN5X1R: { category: "font", description: "Poppins font", fontIds: ["poppins"] },
  FN8Q4M: { category: "font", description: "Nunito font", fontIds: ["nunito"] },
  FN3W9J: { category: "font", description: "Raleway font", fontIds: ["raleway"] },
  FN6P2C: { category: "font", description: "DM Sans font", fontIds: ["dm-sans"] },
  FN1N7Z: {
    category: "font",
    description: "Playfair Display font",
    fontIds: ["playfair"],
  },
  FN4D0K: { category: "font", description: "Space Mono font", fontIds: ["space-mono"] },
  FN7H5B: {
    category: "font",
    description: "Merriweather font",
    fontIds: ["merriweather"],
  },
  FN0Y3S: {
    category: "font",
    description: "Concert One font",
    fontIds: ["concert-one"],
  },
  FN2L8W: {
    category: "font",
    description: "Schoolbell font",
    fontIds: ["schoolbell"],
  },
  FN5C1X: { category: "font", description: "Chewy font", fontIds: ["chewy"] },
  FN8F4Q: {
    category: "font",
    description: "Indie Flower font",
    fontIds: ["indie-flower"],
  },
  FN1K9D: { category: "font", description: "Pacifico font", fontIds: ["pacifico"] },

  // ---- Subject team codes ----
  TEAMCS: {
    category: "team",
    description: "CS Terminal themes + Share Tech Mono font",
    themeIds: ["cs-light", "cs-dark"],
    fontIds: ["share-tech-mono"],
  },
  TEAMCHEM: {
    category: "team",
    description: "Chem Lab themes + Rajdhani font",
    themeIds: ["chem-light", "chem-dark"],
    fontIds: ["rajdhani"],
  },
  TEAMBIO: {
    category: "team",
    description: "Bio Specimen themes + Comfortaa font",
    themeIds: ["bio-light", "bio-dark"],
    fontIds: ["comfortaa"],
  },
  TEAMCLASSICS: {
    category: "team",
    description: "Classics Papyrus themes + Cinzel font",
    themeIds: ["classics-light", "classics-dark"],
    fontIds: ["cinzel"],
  },
  TEAMPHYSICS: {
    category: "team",
    description:
      "Physics Notebook + Oscilloscope + Signal themes + Share Tech Mono font",
    themeIds: ["physics-notebook", "physics-oscilloscope", "physics-signal"],
    fontIds: ["share-tech-mono"],
  },

  // ---- Master codes (unlock everything) ----
  MX9Z2QV: { category: "master", description: "All themes and fonts", master: true },
  LEHS2025: { category: "master", description: "All themes and fonts", master: true },

  // ---- Staff room ----
  THESTAFFROOM: {
    category: "staff",
    description: "Reveals the code reference panel",
    staff: true,
  },

  // ---- Debug-only ----
  COINMAX: {
    category: "debug",
    description: "Set coin balance to 9999",
    debugAction: "coinmax",
  },
  RESETALL: {
    category: "debug",
    description: "Wipe all progress and coins (current user only)",
    debugAction: "resetall",
  },
  DEBUGMODE: {
    category: "debug",
    description: "Enable debug mode toggle",
    debugAction: "debugmode",
  },
};

export interface RedeemResult {
  success: boolean;
  alreadyRedeemed?: boolean;
  description?: string;
  error?: string;
  // For staff-room: a flag the panel can read to open the reference list.
  openStaffRoom?: boolean;
  // For RESETALL: the caller should reload after handling.
  fullReset?: boolean;
}

function isDevEnv(): boolean {
  // Vite exposes DEV via import.meta.env. Debug codes are gated behind it
  // per spec: "only in development". The Settings -> Debug toggle uses the
  // same signal so behaviour is consistent.
  try {
    return import.meta.env.DEV === true;
  } catch {
    return false;
  }
}

export async function redeemCode(rawCode: string): Promise<RedeemResult> {
  const normalised = rawCode.trim().toUpperCase();
  if (!normalised) return { success: false, error: "Enter a code first." };

  const profile = await db.profile.get("self");
  if (!profile) return { success: false, error: "Profile not loaded yet." };

  const already = profile.settings.unlockedCodes ?? [];
  if (already.includes(normalised)) {
    return { success: true, alreadyRedeemed: true, description: "Already redeemed." };
  }

  const def = CODES[normalised];
  if (!def) return { success: false, error: "That code doesn't match anything." };

  // Debug codes only fire in development builds.
  if (def.category === "debug" && !isDevEnv()) {
    return { success: false, error: "That code doesn't match anything." };
  }

  const newUnlockedCodes = [...already, normalised];

  if (def.category === "master" || def.master) {
    // Unlock every theme (excluding default-light/dark, those are already
    // owned) and every font.
    const allThemes = ALL_THEMES.filter(
      (t) => t.category !== "default-light" && t.category !== "default-dark",
    ).map((t) => t.id);
    const allFonts = FONTS.filter((f) => f.id !== "system").map((f) => f.id);
    const merged = mergeUnlocks(profile.settings, {
      themes: allThemes,
      fonts: allFonts,
    });
    await db.profile.update("self", {
      settings: { ...merged, unlockedCodes: newUnlockedCodes },
    });
    await bumpVersion("master code redeemed");
    return { success: true, description: def.description };
  }

  if (def.debugAction === "coinmax") {
    await setCoinBalance(9999);
    await db.profile.update("self", {
      settings: { ...profile.settings, unlockedCodes: newUnlockedCodes },
    });
    return { success: true, description: "Coin balance set to 9999." };
  }

  if (def.debugAction === "resetall") {
    // Wipe gamification state only — decks/cards stay. Per spec wording:
    // "Wipes all progress and coins for the current user only".
    await db.profile.update("self", {
      settings: {
        ...profile.settings,
        coins: 0,
        unlockedThemes: [],
        unlockedFonts: [],
        unlockedCodes: [],
        themeId: undefined,
        fontId: undefined,
        coinsToday: undefined,
        lastKnownRank: undefined,
      },
    });
    await bumpVersion("progress reset");
    return { success: true, description: def.description, fullReset: true };
  }

  if (def.debugAction === "debugmode") {
    await db.profile.update("self", {
      settings: {
        ...profile.settings,
        debugMode: true,
        unlockedCodes: newUnlockedCodes,
      },
    });
    await bumpVersion("debug mode enabled");
    return { success: true, description: def.description };
  }

  if (def.staff) {
    await db.profile.update("self", {
      settings: { ...profile.settings, unlockedCodes: newUnlockedCodes },
    });
    return { success: true, openStaffRoom: true, description: def.description };
  }

  // Plain theme / font / team unlock.
  const merged = mergeUnlocks(profile.settings, {
    themes: def.themeIds ?? [],
    fonts: def.fontIds ?? [],
  });
  await db.profile.update("self", {
    settings: { ...merged, unlockedCodes: newUnlockedCodes },
  });
  await bumpVersion("code redeemed");
  return { success: true, description: def.description };
}

function mergeUnlocks(
  settings: import("../db/types").ProfileSettings,
  add: { themes?: string[]; fonts?: string[] },
) {
  const themes = new Set([...(settings.unlockedThemes ?? []), ...(add.themes ?? [])]);
  const fonts = new Set([...(settings.unlockedFonts ?? []), ...(add.fonts ?? [])]);
  return {
    ...settings,
    unlockedThemes: Array.from(themes),
    unlockedFonts: Array.from(fonts),
  };
}

// Helper used by the staff-room reference panel.
export function listAllCodes(): { code: string; description: string; category: CodeCategory }[] {
  return Object.entries(CODES).map(([code, def]) => ({
    code,
    description: def.description,
    category: def.category,
  }));
}
