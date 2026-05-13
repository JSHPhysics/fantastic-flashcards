import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./schema";
import type { Profile, ProfileSettings } from "./types";

const DEFAULT_SETTINGS: ProfileSettings = {
  themeMode: "system",
  audioAutoplayOnShow: false,
  audioAutoplayOnReveal: true,
  ttsAutoplayOnShow: false,
  ttsAutoplayOnReveal: true,
  showTimerInSession: true,
  defaultDailyNewLimit: 20,
  defaultDailyReviewLimit: 200,
  debugMode: false,
  // Online voices on by default so the speaker icons read with authentic
  // accents out of the box — most students have internet, and the local
  // fallback kicks in cleanly when they don't. Students who prefer
  // device-only can turn it off in Settings.
  useOnlineVoices: true,
  // Gamification: zero coins, nothing unlocked beyond the free set.
  coins: 0,
  unlockedThemes: [],
  unlockedFonts: [],
  unlockedCodes: [],
};

export async function ensureProfile(): Promise<Profile> {
  const existing = await db.profile.get("self");
  if (existing) return existing;
  const now = Date.now();
  const fresh: Profile = {
    id: "self",
    displayName: "Student",
    createdAt: now,
    version: 0,
    lastChangeAt: now,
    lastBackupAt: 0,
    streakDays: 0,
    longestStreak: 0,
    lastReviewDate: "",
    settings: DEFAULT_SETTINGS,
  };
  await db.profile.put(fresh);
  return fresh;
}

// bumpVersion runs after every meaningful mutation (Playbook 3). Backup nudge
// in Session 13 watches lastChangeAt vs lastBackupAt to decide when to prompt.
export async function bumpVersion(_reason: string): Promise<void> {
  await db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("self");
    if (!p) return;
    await db.profile.update("self", {
      version: p.version + 1,
      lastChangeAt: Date.now(),
    });
  });
}

export async function markBackupSaved(): Promise<void> {
  await db.profile.update("self", { lastBackupAt: Date.now() });
}

export async function updateSettings(
  patch: Partial<ProfileSettings>,
): Promise<void> {
  await db.transaction("rw", db.profile, async () => {
    const p = await db.profile.get("self");
    if (!p) return;
    await db.profile.update("self", {
      settings: { ...p.settings, ...patch },
    });
  });
  await bumpVersion("settings change");
}

export function useProfile(): Profile | undefined {
  return useLiveQuery(() => db.profile.get("self"));
}
