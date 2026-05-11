import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { readFileSync } from "node:fs";

// Read the version once at config-load time and inject it as a build-time
// constant. Lets the backup module stamp manifests with the running app
// version without shipping all of package.json to the client.
const pkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf8"),
) as { version: string };
const APP_VERSION = pkg.version;
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// base set for GitHub Pages project hosting; harmless in dev
export default defineConfig({
  base: "/fantastic-flashcards/",
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
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
