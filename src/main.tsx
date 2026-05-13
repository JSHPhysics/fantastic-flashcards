import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ensureProfile, sweepOrphanedMedia, seedDevData } from "./db";
import "./index.css";

// ---- Recovery / kill-switch ---------------------------------------------
//
// If the page is opened with `?reset-app=1`, we wipe everything (service
// workers, caches, IndexedDB, localStorage) and reload to a clean origin.
// This is the user-facing recovery path for a stuck service worker or a
// broken cached build — particularly useful on iPad Safari, where you
// can't easily clear site data per origin without going through iOS
// Settings.
//
// We do this BEFORE any React mount so the broken state doesn't get a
// chance to crash the bundle on the way down.
if (typeof window !== "undefined" && new URLSearchParams(location.search).has("reset-app")) {
  void resetEverythingAndReload();
} else {
  bootApp();
}

async function resetEverythingAndReload(): Promise<void> {
  const fb = document.getElementById("boot-fallback");
  if (fb) {
    fb.innerHTML =
      '<div style="text-align:center;color:#1E3A5F">Resetting the app...</div>';
  }
  try {
    // 1. Unregister every service worker so cached responses can't intercept
    //    the next page load.
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    // 2. Clear the Cache Storage API (workbox precache lives here).
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    // 3. Wipe IndexedDB. Dexie's delete() handles the main app DB;
    //    indexedDB.databases() catches anything stragglers (Safari lacks
    //    .databases() so we fall back to deleting the known name).
    try {
      // Lazy-import to avoid pulling Dexie into the recovery path's
      // critical-init code on normal launches.
      const { db } = await import("./db/schema");
      await db.delete();
    } catch {
      // ignore — fallback below
    }
    try {
      // Safari may not have indexedDB.databases(); guard the call.
      const dbsFn = (indexedDB as IDBFactory & {
        databases?: () => Promise<{ name?: string }[]>;
      }).databases;
      if (typeof dbsFn === "function") {
        const dbs = await dbsFn.call(indexedDB);
        await Promise.all(
          dbs
            .filter((d) => d.name)
            .map((d) => deleteDb(d.name as string)),
        );
      }
    } catch {
      // ignore
    }
    // 4. localStorage + sessionStorage — small but might hold a broken
    //    flag (theme id, install-dismissed, etc.).
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // private mode etc.
    }
  } finally {
    // Strip the query param + reload from the clean URL.
    location.replace(location.pathname);
  }
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function bootApp(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("root element missing");

  // Fire-and-forget DB init. Live queries pick up the seed within a tick;
  // blocking render would only delay first paint.
  void (async () => {
    try {
      await ensureProfile();
      await sweepOrphanedMedia();
      if (import.meta.env.DEV) await seedDevData();
      void requestPersistentStorage();
    } catch (err) {
      console.error("[db] init failed", err);
    }
  })();

  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

// Ask the browser to keep IndexedDB persistent. On most browsers this
// silently succeeds based on engagement signals (PWA installed, the user
// returns frequently, etc.); on Safari the call is a no-op. Settings shows
// the result so the user can confirm.
async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const already = await navigator.storage.persisted();
    if (already) return;
    await navigator.storage.persist();
  } catch {
    // Some browsers throw when called outside a user gesture; ignore.
  }
}
