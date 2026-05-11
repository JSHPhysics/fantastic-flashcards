// Copy dist/index.html to dist/404.html so deep links work on GitHub Pages.
// Without this, refreshing on /fantastic-flashcards/settings (or any non-root
// route) returns 404 because GH Pages serves static files only and doesn't
// know about React Router. With this, GH Pages serves 404.html for unknown
// paths; the SPA boots, reads window.location, and routes client-side.

import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve("dist", "index.html");
const dest = resolve("dist", "404.html");

if (!existsSync(src)) {
  console.error("[spa-fallback] dist/index.html not found; did vite build run?");
  process.exit(1);
}

copyFileSync(src, dest);
console.log("[spa-fallback] dist/404.html written");
