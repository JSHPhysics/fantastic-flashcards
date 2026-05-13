# Fantastic Flashcards

A local-first flashcards web app for students. Quizlet-quality interface,
Anki-quality scheduling. Works offline. No accounts, no tracking, no
ads, no subscription. All data lives on your device until you choose to
back it up.

**Live:** https://jshphysics.github.io/fantastic-flashcards/

Built by Joshua Stafford-Haworth (JSHPhysics).

---

## For students

### What you get

- **Six card types**: Basic, Cloze (fill-in-the-blank), Multiple choice,
  Typed answer, Image occlusion, Drawing.
- **Spaced repetition** via FSRS — the algorithm decides when each card
  is due so you spend time on what you're about to forget, not what you
  already know.
- **Sub-decks** so you can organise by subject, topic, or whatever
  scheme suits.
- **Text-to-speech** for language learning — works on-device, or via
  Google's online voices for authentic accents.
- **Photos, audio, and drawings** as card content. Take a photo of a
  diagram, draw a structure with your finger or Apple Pencil.
- **Stats**: daily / weekly / yearly heatmap, streak tracking, accuracy,
  per-deck progress.
- **Coins, ranks, themes, fonts** — earn coins as you review, unlock
  themes, redeem teacher codes for subject bundles.

### How to use it on iPad

1. Open the live URL in Safari.
2. Tap the Share icon → **Add to Home Screen** → tap Add.
3. Tap the home-screen icon to launch — the app opens full-screen, no
   Safari chrome.
4. Use offline from this point. Nothing leaves the device.

### How to use it on Android

1. Open the live URL in Chrome.
2. Three-dot menu → **Install app** (or **Add to Home screen**).
3. Tap the home-screen icon to launch.

### How to use it on desktop

Just visit the URL. Optionally: most browsers offer "Install" from the
address-bar URL menu.

### Backing up your work

Settings → **Back up to a file** → Export backup. This saves a single
`.flashcards` file containing every deck, card, image, audio recording,
review history, and unlocked theme. Drop it in OneDrive / Google Drive
/ iCloud / a folder you sync — wherever you like.

On another device: install the app, Settings → Import backup, pick the
file. The diff preview shows what will be added before you commit.

### If something goes wrong

If the app shows a gray page or otherwise looks broken, the offline
cache may be stuck. Try:

`https://jshphysics.github.io/fantastic-flashcards/?reset-app=1`

This wipes the offline cache and local data, then reloads clean. **Back
up first if there's anything you want to keep** — your `.flashcards`
file stays safe wherever you saved it.

### Privacy

- No accounts. No login.
- No analytics, telemetry, or third-party trackers.
- The only network call the app makes (when you opt in) is to Google's
  text-to-speech endpoint for authentic-accent pronunciation. The card
  text gets sent so Google can speak it back. Off-by-default and you
  can turn it off in Settings → "Use Google online voices".
- Everything else stays on your device. Backups go where you put them.

---

## For teachers

Hand the live URL to students. No setup, no permission slips, no
account creation. Each student's data is their own.

### Subject team codes

Five subject-themed bundles unlock at the Codes tab in the shop. Each
gives a light and a dark theme plus the matching font:

| Code | Subject | What it unlocks |
|---|---|---|
| `TEAMCS` | Computer Science | CS Terminal Light + Dark + Share Tech Mono |
| `TEAMCHEM` | Chemistry | Chem Lab Light + Dark + Rajdhani |
| `TEAMBIO` | Biology | Bio Specimen Light + Dark + Comfortaa |
| `TEAMCLASSICS` | Classics | Classics Papyrus Light + Dark + Cinzel |
| `TEAMPHYSICS` | Physics | Physics Notebook Light + Oscilloscope Dark + Signal Dark + Share Tech Mono |

`THESTAFFROOM` opens a reference panel listing every code.

### Importing from Quizlet

Settings → Home → "Import from Quizlet". Paste the Quizlet export (Tab
between term and definition, New line between cards by default).
Optionally set a language for each side so the speaker icons read in
the correct accent.

---

## For contributors

### Tech stack

- Vite + React 18 + TypeScript 5.6 + Tailwind CSS 3
- Dexie.js for IndexedDB (single source of truth for all data)
- ts-fsrs for spaced-repetition scheduling
- vite-plugin-pwa (Workbox) for offline + install
- Konva.js for the occlusion and drawing canvases (lazy-loaded)
- fflate for backup zip (lazy-loaded)

No backend. No analytics SDK. No state-management library — Dexie
live-queries via `dexie-react-hooks` are the source of truth and React
renders from them.

### Local development

```
git clone https://github.com/JSHPhysics/fantastic-flashcards.git
cd fantastic-flashcards
npm install
npm run dev
```

Dev server runs at `http://localhost:5173/fantastic-flashcards/`. Seeded
with 2 decks × 5 cards so live-queries have something to render
immediately.

`window.__wipeDev()` and `window.__seedDev()` in DevTools wipe / re-seed
the IndexedDB. The `?reset-app=1` URL parameter does the same plus
unregisters the service worker — useful for testing a clean install.

### Repo conventions

- **Plain-English user copy.** No "chip", "propagate", "endpoint",
  "schema" in user-facing strings. Playbook section 11 has the swap
  table.
- **Cards own all media refcounts.** `createCard` / `updateCard` /
  `deleteCard` retain and release media. `storeMedia` is idempotent
  and never touches refcount.
- **Dexie usage confined to `src/db/`.** Components import from
  `../db`, not `dexie` directly.
- **Konva is lazy-loaded.** Editors + the drawing-card review canvas
  are dynamic-imported.
- **Themes are CSS variables.** Tailwind tokens (`bg-cream`,
  `text-navy/30`) resolve to `rgb(var(--color-X) / alpha)`. Any theme
  can override the palette without touching utility classes.

Before each commit, all three must be green:

```
npm run typecheck
npm run lint
npm run build
```

### Documentation

- `SESSION-LOG.md` — current status + what's next + how to resume on a
  new machine. Read this first if you're picking the project back up.
- `FantasticFlashcards-Playbook.md` — full spec. Every feature's
  contract, data model, design system. Read before making
  architectural decisions.
- `QA-CHECKLIST.md` — live retest items + deferred polish.
- `DESIGN-DECISIONS.md` — rejected ideas with rationale. Skim before
  re-proposing a refactor we've already debated.
- `FantasticFlashcards-BuildPlan.md` — original 16-session build brief.
  Historical; sessions 1–14 are shipped, 15–16 in progress.

### Deploying

`.github/workflows/deploy.yml` builds on every push to `main` and ships
to GitHub Pages via the official Pages Actions. One-time repo setup
(already done for this repo): Settings → Pages → Source = GitHub
Actions.

---

## Licence + attribution

MIT. Built by Joshua Stafford-Haworth (JSHPhysics). Not affiliated
with any school.

Issues, ideas, and PRs welcome at
https://github.com/JSHPhysics/fantastic-flashcards.
