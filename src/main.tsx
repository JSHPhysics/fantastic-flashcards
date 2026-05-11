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
  } catch (err) {
    console.error("[db] init failed", err);
  }
})();

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
