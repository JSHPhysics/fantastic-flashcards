import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { ensureProfile, sweepOrphanedMedia, seedDevData } from "./db";
import "./index.css";

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

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
