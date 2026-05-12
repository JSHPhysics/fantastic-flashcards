// Theme + font runtime manager.
//
// Reads ProfileSettings.themeId, themeMode, and fontId, then mirrors that
// state onto document.documentElement so CSS variables resolve to the
// current palette and font.
//
// Rules:
//  - themeId set (premium theme picked): apply data-theme="<id>", clear
//    .dark class — the theme's CSS variables already encode whether it's
//    light or dark.
//  - themeId unset: clear data-theme, apply .dark based on themeMode
//    ("dark" => always, "system" => prefers-color-scheme:dark, "light" =>
//    never). This is the legacy single-toggle behaviour.
//  - fontId set: set --font-family on :root and ensure the font's Google
//    stylesheet is in the head.
//
// Mount this hook once at the root (App.tsx) — it subscribes to the live
// profile and to the system color-scheme media query.

import { useEffect } from "react";
import { useProfile } from "../db";
import { getTheme } from "./catalogue";
import { getFont, ensureFontLoaded } from "./fonts";

export function useThemeManager(): void {
  const profile = useProfile();
  const themeId = profile?.settings.themeId;
  const themeMode = profile?.settings.themeMode ?? "system";
  const fontId = profile?.settings.fontId;

  // Theme application.
  useEffect(() => {
    const html = document.documentElement;
    const theme = getTheme(themeId);

    if (theme && theme.category !== "default-light" && theme.category !== "default-dark") {
      // Premium / free / subject theme — own palette via CSS vars.
      html.dataset.theme = theme.id;
      html.classList.remove("dark");
      return;
    }

    // No premium theme — fall back to light/dark via themeMode.
    delete html.dataset.theme;
    const apply = (dark: boolean) => html.classList.toggle("dark", dark);

    if (themeMode === "dark" || themeId === "default-dark") {
      apply(true);
      return;
    }
    if (themeMode === "light" || themeId === "default-light") {
      apply(false);
      return;
    }
    // System mode: follow prefers-color-scheme and watch for changes.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeId, themeMode]);

  // Font application.
  useEffect(() => {
    const html = document.documentElement;
    const font = getFont(fontId);
    if (!font) {
      html.style.removeProperty("--font-family");
      return;
    }
    ensureFontLoaded(font);
    html.style.setProperty("--font-family", font.stack);
  }, [fontId]);
}
