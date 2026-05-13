# FantasticFlashcards: Claude Code Build Plan (v1.0)

Author: Joshua Stafford-Haworth (JSHPhysics)

> **Status (historical):** Sessions 1–14 are shipped. Sessions 15
> (accessibility + iPad QA + final polish) and 16 (README + v1.0.0
> tag) are in progress — see `SESSION-LOG.md` for current state and
> next steps. This file is kept as the original brief for
> architectural context; day-to-day work plans live in the
> SESSION-LOG.

This document was the handoff brief for Claude Code. Each session is scoped to fit in one focused working pass, ending in a runnable, demonstrable state. Sessions build linearly; later sessions assume earlier ones are complete.

## Project context for any fresh Claude Code session

You are building FantasticFlashcards, a local-first flashcards PWA designed for iPad-first use by teenagers with full desktop parity. See `FantasticFlashcards-Playbook.md` in the project root for the full specification. Read it before making architectural decisions.

Repository: https://github.com/JSHPhysics/fantastic-flashcards

If starting from a fresh machine, clone the repo first:
```
git clone https://github.com/JSHPhysics/fantastic-flashcards.git
cd fantastic-flashcards
```

Core principles to honour throughout:
- Local-first. No backend, no analytics, no telemetry. Ever.
- Touch-first UX. Minimum 44pt tap targets.
- Clean, minimalist UI. Cognitive load is the enemy.
- Inform, do not block. (No hard limits on deck size, depth, etc.)
- Privacy is a feature. Never make a network call the user did not initiate.
- Attribution: Joshua Stafford-Haworth / JSHPhysics. Do not attribute to any school.

Stack: Vite + React 18 + TypeScript + Tailwind CSS + Dexie.js + ts-fsrs + Workbox + fflate + Recharts + react-easy-crop + Konva.js (react-konva) + Web Speech API. No other major dependencies without justification.

---

## Session 1: Project scaffold and design system

Goal: a running Vite + React + TS + Tailwind project with the design system tokens wired up and a placeholder home screen.

Tasks:
1. From inside the cloned `fantastic-flashcards` repo: scaffold Vite + React + TS in-place. Run `npm create vite@latest . -- --template react-ts` and accept overwriting if prompted. Ensure `.gitignore` covers `node_modules`, `dist`, and `.env`.
2. Install Tailwind, configure with custom palette tokens from the playbook (cream/navy/gold, four rating colours).
3. Install vite-plugin-pwa and configure a minimal manifest with project name, theme colour, placeholder icons.
4. Set up basic routing with react-router-dom: routes for `/` (home), `/decks/:id`, `/decks/:id/edit`, `/cards/:cardId/edit`, `/cards/new?deckId=...`, `/study`, `/stats`, `/settings`.
5. Build a Layout component with a clean top bar and a bottom tab nav (Home / Stats / Settings) sized for thumb reach.
6. Build typography scale and colour token file at `src/design/tokens.ts`.
7. Create empty page components for every route.
8. Respect `prefers-reduced-motion` globally.

End state: `npm run dev`, navigate between empty screens, design system colours visible.

Deliverable check: project runs, lints clean, all routes navigable, no console errors.

---

## Session 2: Data layer (Dexie schema, repositories, version counter)

Goal: complete IndexedDB schema and typed repository functions for every entity.

Tasks:
1. Install dexie and dexie-react-hooks.
2. `src/db/schema.ts` defines the Dexie database matching every table in the playbook (profile, decks, cards, media, reviews, sessions).
3. Strict TypeScript types matching the playbook for every record, including discriminated unions for `CardContent`.
4. Multi-entry index on `cards.tags` for fast tag filtering.
5. Repository functions per table: create, get, list, update, delete. Dexie transactions where multiple tables update together (e.g. card create updates deck.cardCount and deck.descendantCardCount).
6. Implement `bumpVersion(reason: string)`: increments `profile.version`, sets `lastChangeAt`. Every mutating repository function calls this.
7. Initialise singleton profile on first load with defaults.
8. `useProfile()` hook backed by `useLiveQuery`.
9. Dev-only seed function: 2 sample decks with 5 cards each.

End state: open dev tools, inspect IndexedDB, see all tables with sample data.

Deliverable check: type-safe access from anywhere via repositories. No raw Dexie usage outside `src/db/`.

---

## Session 3: Deck management with sub-decks

Goal: complete deck CRUD with sub-deck tree, plus the depth-warning modal.

Tasks:
1. Home screen shows a deck tree with collapsible nodes. Root decks at top level; sub-decks indented.
2. Each deck row shows: name, subject tag, direct card count, descendant card count if >0, size chip (green/amber/red placeholder for now), due-today badge.
3. FAB ("+") opens Create Deck dialog: name, description, subject, colour (5-6 presets), parent deck (default: root).
4. When parent depth would result in a >4 nested level, show non-blocking modal: "You are about to create a 5th level of nesting. Most decks work best at 3-4 levels. Continue?" Proceed / Cancel.
5. Tap a deck -> deck detail screen: card list, "Study" CTA, "Add card" CTA.
6. Long-press / overflow menu on a deck: Rename, Edit, Duplicate (recursive with cards), Move (re-parent), Delete (with recursive confirm).
7. Move action: shows a tree picker excluding the deck itself and its descendants.
8. Empty states for "no decks yet" and "no cards in this deck".
9. `descendantCardCount` updated on card add/delete and on deck move; walk the parent chain.

End state: build a 3-level deck tree, move decks around, see warning at 5 levels, persistence across reload.

Deliverable check: tree structure correctly persisted, sub-deck warning fires at the right depth, move operation correctly updates counts.

---

## Session 4: Card editor - text-only card types (Basic, Cloze, MCQ, Typed)

Goal: complete authoring for the four text-based card types. Media in session 6.

Tasks:
1. Card editor route. Type tabs at top.
2. **Basic:** front + back text areas, "Auto-generate reverse card" checkbox, live preview pane.
3. **Cloze:** single text area with cloze syntax helper (button wraps selected text in `{{c1::...}}`, auto-renumbers c1, c2, c3 on save). Preview shows masked card. On save, generates one `Card` per cloze number.
4. **MCQ:** question text + dynamic options list with correctness checkboxes (min 2, max 8). Reorder by drag (touch-friendly). Shuffle-options toggle.
5. **Typed:** prompt + comma-separated accepted answers + case-sensitivity and ignore-punctuation toggles.
6. Save creates Card(s) with default `FsrsState` from ts-fsrs.
7. Auto-reverse logic: on Basic save with `autoReverse: true`, create a sibling Card with front and back swapped and `generatedFromCardId` set. Edits propagate; delete cascades.
8. Type-switch warning when destructive ("switching to Basic will discard MCQ options").
9. Sticky header with Cancel / Save / Save and add another.
10. Tags input on every card type with type-ahead from a derived all-tags set.

End state: author one of each type, including a Basic with auto-reverse and a Cloze with three blanks. Verify the right number of Card rows are created. Tags filter works on deck detail.

Deliverable check: all four types editable; cloze generates one card per blank; auto-reverse creates a linked pair.

---

## Session 5: Frozen fields and bulk authoring

Goal: rapid bulk card entry experience.

Tasks:
1. "Save and add another" button in card editor keeps user on the editor with a fresh card.
2. Frozen-fields toggles: small lock icons next to deck selector, tags input, type tab, and per-field language selector. Locked values persist across consecutive new-card creations.
3. Default behaviour: tags and language locked when present; type and deck not locked.
4. Visible "Frozen" pill at top of editor when any field is locked, with quick unlock-all button.
5. State persists in a transient store (`useEditorPrefs`) only within a session; clears on navigation away from the editor.

End state: enter 10 cards in a row into the same deck, with the same tags, switching only the content. Each one is one or two taps to commit.

Deliverable check: bulk entry of 10 vocabulary cards into a French deck takes under 2 minutes with realistic content.

---

## Session 6: Media pipeline (images and audio)

Goal: image and audio import, compression, recording, deduplication.

Tasks:
1. Image picker on every RichField input: tap to choose or drop on desktop.
2. `compressImage(file): Promise<{blob: Blob, hash: string}>`:
   - Read as ImageBitmap.
   - Resize on offscreen canvas to max 1000px long edge.
   - Encode WebP at 0.82 quality via `canvas.toBlob`.
   - SHA-256 via `crypto.subtle.digest`.
3. `storeMedia(blob, mime)`: hash-keyed insert, refCount increment if existing.
4. `releaseMedia(hash)`: refCount decrement; GC sweep on next app load.
5. Optional crop step via react-easy-crop, reachable from a Crop button next to imported images.
6. Audio: tap mic button -> getUserMedia -> MediaRecorder (mono, lowest available bitrate) -> 15s hard cap with countdown -> same hash flow.
7. Editor display: image thumbnail with X to remove; audio mini-player with X to remove.
8. Per-deck size chip: compute deck media bytes by summing `media.bytes` for hashes referenced; denormalise into `deck.mediaBytes` on card save/delete.
9. Device-total in Settings via `navigator.storage.estimate()`.
10. GC sweep on profile load: delete media rows with refCount <= 0.

End state: add an image and audio clip to a card. Reload. Both persist. Add same image to another card. Media table has one row, refCount = 2. Delete one card. refCount = 1.

Deliverable check: deck size chip changes colour as media added. GC reclaims orphaned media on reload.

---

## Session 7: TTS pronunciation

Goal: complete language-pronunciation support.

Tasks:
1. Per-deck `pronunciationLanguage` setting in deck edit screen, with BCP 47 language picker (curated list of ~30 common languages).
2. Per-field language override in card editor (small flag/code chip next to each RichField).
3. `useVoices()` hook: wraps `speechSynthesis.getVoices()` and listens for `voiceschanged`. Returns voices grouped by language.
4. `speak(text, lang)` helper: picks the best voice for the language, falls back to the first voice matching the primary subtag, calls `speechSynthesis.speak()`. Cancels any in-progress speech.
5. Speaker icon component rendered wherever a `RichField` has a language set. Tap to speak.
6. Settings toggles: auto-speak on show, auto-speak on reveal. Wire into the review session flow.
7. Settings explainer panel: "Voice quality depends on languages installed on your device. On iPad, go to Settings -> Accessibility -> Spoken Content to download Enhanced voices for better quality."

End state: create a French vocabulary deck. Authoring with `fr-FR` pronunciation. Speaker icons everywhere. Auto-speak on reveal works during study.

Deliverable check: pronunciation works on iPad Safari with downloaded Enhanced French voice. Tapping the speaker icon plays the word.

---

## Session 8: Image occlusion (5th card type)

Goal: complete occlusion authoring and review.

Tasks:
1. Install konva and react-konva. Lazy-load in editor route.
2. Occlusion editor screen at `/cards/new?type=occlusion&deckId=...`:
   - Pick image -> compressed via standard pipeline -> Konva Stage with image as background.
   - Tools (top bar): rect, ellipse, polygon, group, label, delete, undo, redo.
   - Tap-drag draws rect/ellipse. Polygon: tap points, double-tap or tap-first-point to close.
   - Tap a mask to select. Visible handles 8px, hit areas 32px.
   - Drag body to move, drag handles to resize. Two-finger pinch resizes on iPad.
   - Floating context menu near selected mask: Delete | Duplicate | Group | Add Label.
   - "Done drawing" button exits draw mode so page can scroll again.
   - Mode selector: hide-one (default) or hide-all.
3. Save: writes the image once, then creates N cards (one per mask or mask group), all sharing the same `OcclusionContent.masks` array but with different `activeMaskId`. `generatedFromCardId` not used here; the shared mask data is the linkage.
4. Editing an occlusion card brings up the full editor; saving updates all sibling cards' mask data.
5. Review-time renderer: SVG overlay on the image with rects/ellipses/polygons from geometry data. Mode-aware: hide-one hides active mask(s) and shows others; hide-all hides everything and reveals active on tap. Transitions 200ms fade.
6. Reveal: tap or "Show Answer" button reveals; four-button rating follows.

End state: import a physics diagram (e.g. inclined plane with labelled forces). Draw 5 masks. Save. 5 cards exist. Study them. Each card hides one different mask. Edit the diagram authoring later - all 5 cards reflect the change.

Deliverable check: touch handles are comfortable on iPad. Polygon tool works. Hide-one and hide-all modes both functional at review.

---

## Session 9: Drawing card type (6th card type, self-graded)

Goal: complete pen-drawing card authoring and review.

Tasks:
1. Drawing editor screen at `/cards/new?type=drawing&deckId=...`:
   - Prompt text input + optional background diagram picker.
   - Konva Stage for the model answer canvas (with background diagram if set).
   - Tools: pen (3-4 preset colours), eraser, undo, redo, clear. Pressure-sensitive via Pointer Events.
   - Option to upload an image of the model answer instead of drawing it.
   - Reveal mode selector: overlay / side-by-side / toggle (default).
   - Save: model answer rendered to a WebP via `stage.toDataURL()`, stored as media; only the hash kept on the card.
2. Review-time UI:
   - Show prompt + background diagram (if any).
   - Empty Konva Stage with same tools as the editor (pen colours, eraser, undo, clear).
   - "Show Answer" reveals model answer per `revealMode`:
     - Overlay: model answer drawn over student's drawing at 60% opacity, with a toggle to switch full overlay / side-by-side / your-drawing-only.
     - Side-by-side: split view, student on left, model on right.
     - Toggle: tap to flip between student and model views.
   - Four-button self-rating.
   - Drawing discarded after rating (no persistence).
3. Touch handling: Pointer Events API throughout for pen/finger distinction. Disable page scroll while pointer is down on the stage; re-enable on pointer up.

End state: create a "Draw the force diagram for a block on an incline" card. Study it. Draw your answer with Apple Pencil. Reveal model. Self-rate. Next session, the canvas is fresh.

Deliverable check: drawing experience is responsive on iPad with Apple Pencil. Reveal modes all work. Drawings genuinely discarded.

---

## Session 10: FSRS scheduler and standard review session

Goal: working spaced repetition sessions end-to-end for all card types.

Tasks:
1. `src/srs/scheduler.ts` wraps ts-fsrs: `initState()`, `applyRating(state, rating)`, `cardIsDue(state, now)`.
2. Session builder: given a deck (with subdeck-include toggle), returns ordered cards: overdue reviews first, then due today, then up to N new (per deck daily limit).
3. Review session screen at `/study?deck=<id>&includeSubDecks=true`.
4. Top bar: progress, session time, deck name, Exit (with confirm if mid-session).
5. Card type rendering: dispatch to the appropriate component for each of the 6 types using flows defined in playbook section 7.
6. On rating: write a `ReviewEvent`, update `card.fsrs`, advance.
7. TTS auto-speak hooks fire on show and reveal per settings.
8. Session end: write a `Session` row, navigate to summary screen.
9. Summary: cards reviewed, accuracy %, time spent, streak update, rating breakdown bar chart, Share + Done buttons.
10. Streak logic: rest-day-allowance per playbook section 7. Track `restDayUsedDate` on profile.

End state: review a mixed deck containing all 6 card types end-to-end. Cards reschedule properly. Streak increments.

Deliverable check: review the same card 5 times across simulated days (manipulate FSRS state directly for testing) - intervals lengthen correctly.

---

## Session 11: Custom Study mode

Goal: drill-by-criteria study mode.

Tasks:
1. "Custom Study" button on home screen and on deck detail.
2. Custom Study setup screen with form:
   - Deck multi-select (with sub-deck include toggle).
   - Tag filter: pick tags + match mode (any / all).
   - Card type filter: checkboxes for each of 6 types.
   - Recent mistakes: "include only cards I rated Again or Hard in the last N days" with N input.
   - Max cards slider.
   - Shuffle toggle.
3. "Start" builds the card list per filters, kicks off a review session with `mode: "custom-study"` and the config stored on the session row.
4. Card scheduling in custom study mode: by default, custom study reviews **do not affect FSRS scheduling** (a drill, not a real review). Configurable per session: a "Update spaced repetition" toggle (default off).
5. Session history shows custom study sessions distinguishably with the filter summary.

End state: build a custom study session: "All cards in Physics > Year 11 tagged 'tricky' that I got wrong in the last 7 days, max 20 cards, shuffled." Study them. FSRS state untouched. Original review schedule preserved.

Deliverable check: custom filter logic correct. "Repeat last custom study" works from history.

---

## Session 12: Stats, history, progress graphs

Goal: the "workout app for your brain" experience.

Tasks:
1. Stats screen with three sub-views: Today / This Week / All Time.
2. **Today:** big number for cards reviewed, accuracy ring chart, time spent, current streak with rest-day indicator.
3. **This Week:** bar chart (cards per day) + line overlay (accuracy). Tap a bar to drill into that day's sessions.
4. **All Time:** 52-week heatmap calendar (GitHub-style), intensity from review count. Tap a cell to see that day's sessions.
5. Per-deck stats from deck detail: mature / learning / new donut chart.
6. "Share weekly stats" button: render week view to offscreen canvas at 2x resolution -> blob -> Web Share API. Fallback to download.
7. "Share session summary" from session end screen: same flow.

End state: after a week of usage, charts are meaningful and shareable.

Deliverable check: heatmap renders correctly. Share on iPad opens system share sheet with PNG attached.

---

## Session 13: Backup export/import

Goal: complete cross-device sync via manual backup files.

Tasks:
1. Install fflate.
2. `exportBackup(): Promise<Blob>`:
   - Read all tables.
   - Build manifest.json (schemaVersion, appVersion, exportedAt, profileVersion, counts, mediaBytes).
   - Serialise profile/decks/cards/reviews/sessions as JSON files.
   - Stream all media blobs into `media/<hash>.<ext>` zip entries.
   - Zip via fflate.
3. Settings -> "Export Backup":
   - Default filename: `flashcards-YYYY-MM-DDTHHMM-v<version>.flashcards`.
   - Web Share API where supported (iPad), else download.
   - On success, set `profile.lastBackupAt`.
4. Settings -> "Import Backup":
   - File picker (accept=".flashcards,application/zip").
   - Parse with fflate, validate manifest.
   - Compare versions, show diff confirmation: "Backup contains 12 decks, 1240 cards. Local has 8 decks, 980 cards. Replace local data?"
   - On confirm, transactional clear and insert.
5. 20-hour smart nudge:
   - On app load and after each session end, check condition.
   - If met, show non-blocking toast: "Time to back up - tap to save your data." Dismissable. Re-appears next check.
6. "Last backup: 3 days ago" indicator visible in Settings.

End state: export backup, wipe browser storage, import backup, all data restored exactly.

Deliverable check: backup round-trips losslessly. Open as zip in Finder/Explorer - structure matches playbook section 4.

---

## Session 14: PWA polish, install flow, offline behaviour

Goal: production-grade PWA.

Tasks:
1. Generate proper app icons at 192, 512, maskable 512 (clean monogram or icon).
2. Configure vite-plugin-pwa with Workbox.
3. Precache entire app shell. Verify Lighthouse PWA audit.
4. Test airplane mode end-to-end: study, authoring, backups.
5. iOS install tip on first launch in browser tab: "Tap Share -> Add to Home Screen for the full app experience." Dismissable.
6. Call `navigator.storage.persist()` after first session completion.
7. Storage status in Settings: "Storage is persistent" or "Storage may be cleared automatically. Install to home screen to fix."
8. App version + build date in Settings -> About.
9. Service worker update flow: small "Update available" banner -> tap -> skipWaiting + reload.

End state: app installs on iPad and desktop, works fully offline, updates cleanly.

Deliverable check: install on real iPad, go fully offline, complete study session, export backup. All works.

---

## Session 15: Final polish, accessibility, iPad QA

Goal: production-ready surface area.

Tasks:
1. Settings screen complete: display name, theme, audio autoplay toggles (4 total), timer toggle, daily limits, storage info, persistent storage status, language voice list inspector, about/version, backup buttons.
2. Privacy notice screen reachable from Settings: plain English one-pager.
3. Empty states and error states throughout: friendly, actionable, no dead ends.
4. Accessibility pass:
   - All interactive elements keyboard reachable.
   - Visible focus rings.
   - ARIA labels on icon-only buttons.
   - Colour never sole carrier of meaning (rating buttons also labelled).
   - Sufficient contrast in both themes.
   - Screen reader checks on iPad VoiceOver for the core flows.
5. iPad QA on real device:
   - Tap targets >= 44pt audit.
   - Keyboard avoidance on every input.
   - Apple Pencil works smoothly in drawing and occlusion.
   - Share sheet works for session summary, weekly stats, backup export.
   - Install-to-home-screen flow.
6. Performance: bundle size check (target < 600KB gzipped for app shell with Konva lazy-loaded), code-split editor routes if helpful.
7. Final lint, type check, dead code sweep.

End state: ready to deploy.

Deliverable check: a teenager can pick it up and use it without instructions. Real iPad QA passes.

---

## Session 16: Deploy to GitHub Pages, write end-user README

Goal: live, shareable, documented.

Tasks:
1. Configure `vite.config.ts` with `base: '/fantastic-flashcards/'` so asset paths work under the GitHub Pages project URL.
2. GitHub Actions workflow: build and deploy to `gh-pages` branch on push to main.
3. Test deployed URL on real iPad: install, use, export backup.
4. Write `README.md` for students and teachers:
   - What it is, who it's for, why it exists.
   - How to install on iPad and desktop.
   - How to back up to OneDrive (step-by-step with screenshots).
   - How to import a backup on a new device.
   - All six card types, briefly explained.
   - Privacy statement.
   - Credits: Joshua Stafford-Haworth / JSHPhysics.
5. `CHANGELOG.md` starting at v1.0.0.
6. Tag v1.0.0 release.

End state: live URL, students can install and use, README explains everything.

Deliverable check: hand the URL to a student who has never seen the app. They get going within 2 minutes.

---

## Notes for any Claude Code session

- Read `FantasticFlashcards-Playbook.md` first to ground decisions.
- Keep dependencies minimal. Justify every addition in a code comment.
- Prefer surgical edits over rewrites when iterating.
- Default to clean rebuilds of files rather than tracked-change diffs.
- ASCII-safe output for any data files or exports.
- All commit messages and code attribution: Joshua Stafford-Haworth / JSHPhysics. No school affiliation.
