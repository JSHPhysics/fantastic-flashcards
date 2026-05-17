import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Read the version once at config-load time and inject it as a build-time
// constant. Lets the backup module stamp manifests with the running app
// version without shipping all of package.json to the client.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string };
const APP_VERSION = pkg.version;

// Build identity: short git SHA + branch + build timestamp. Surfaced in
// Settings → About so on-device testing can confirm "yes, this is the
// build I just pushed" by comparing the SHA against `git log -1`.
// Wrapped in try/catch so a build outside a git checkout (rare, but
// possible for tarball-style installs) still succeeds with placeholders.
function readBuildIdentity(): { sha: string; branch: string } {
  try {
    const sha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    // GITHUB_REF_NAME is "main" on a push to main; in local dev it's
    // unset so we fall back to git. CI checkout leaves HEAD detached,
    // so the raw `git rev-parse --abbrev-ref` returns "HEAD" — the env
    // var is the only reliable branch source in Actions.
    let branch = (process.env.GITHUB_REF_NAME ?? "").trim();
    if (!branch) {
      const head = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
      }).trim();
      branch = head === "HEAD" ? "(detached)" : head;
    }
    return { sha, branch };
  } catch {
    return { sha: "unknown", branch: "unknown" };
  }
}
const { sha: GIT_SHA, branch: GIT_BRANCH } = readBuildIdentity();
// ISO minute precision — "2026-05-17 13:45 UTC". Day-only granularity
// wasn't enough to tell whether a deploy actually rolled, so this is
// upgraded to datetime. JSON.stringify wraps it for `define` correctly.
const BUILD_TIME = new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", " ") + " UTC";

// base set for GitHub Pages project hosting; harmless in dev
export default defineConfig({
  base: "/fantastic-flashcards/",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __GIT_SHA__: JSON.stringify(GIT_SHA),
    __GIT_BRANCH__: JSON.stringify(GIT_BRANCH),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt" gives the user explicit control over when an update applies,
      // so a study session in progress isn't disturbed by a silent SW swap.
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Fantastic Flashcards",
        short_name: "Flashcards",
        description:
          "Local-first flashcards with spaced repetition. Privacy by design.",
        start_url: "/fantastic-flashcards/",
        scope: "/fantastic-flashcards/",
        display: "standalone",
        background_color: "#FAF7F2",
        theme_color: "#1E3A5F",
        icons: [
          {
            src: "icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
      },
    }),
  ],
});
