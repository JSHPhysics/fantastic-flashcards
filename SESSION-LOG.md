# Session log

Tracks build-plan progress so any device (or any fresh Claude Code session) can
pick up without context. Keep entries terse; commit messages hold the detail.

---

## Status

**Last completed:** Session 7 — TTS pronunciation
**Next up:** Session 8 — image occlusion (Konva.js, touch / pen handles)
**Stopping discipline (new):** After each session, do a rigorous code review
before moving on. Fix bugs found during the review in a follow-up commit. Don't
build on bad code.

**Deploy is live (Session 16 work front-loaded):**
https://jshphysics.github.io/fantastic-flashcards/ — `.github/workflows/deploy.yml`
builds on push to `main` and deploys via the official GitHub Pages actions.
First-time setup the repo owner must do (one-time): GitHub repo →
Settings → Pages → "Build and deployment" → Source = **GitHub Actions**
(not "Deploy from a branch"). After that, every push to main redeploys.

## Resume on a new machine

```
git clone https://github.com/JSHPhysics/fantastic-flashcards.git
cd fantastic-flashcards
npm install
npm run dev       # http://localhost:5173/fantastic-flashcards/ (or 5174 etc.)
```

`npm run dev` serves the app with seeded data (2 decks x 5 cards, dev-only). To
reset the local IndexedDB during dev, open DevTools and run `window.__wipeDev()`;
to re-seed, `window.__seedDev()`.

Build / typecheck / lint must stay green before each commit:

```
npm run typecheck
npm run lint
npm run build
```

## Build-plan progress

| Session | Title                                          | Status        | Commit    |
|---------|------------------------------------------------|---------------|-----------|
| 1       | Scaffold + design system + routing + PWA       | Done          | `b250a8d` |
| 2       | Dexie data layer + repositories + version cnt  | Done          | `2b49d5c` |
| 3       | Deck management with sub-decks                 | Done          | `da8eb48` |
| 4       | Card editor: Basic, Cloze, MCQ, Typed          | Done          | `f1fa428` |
| 5       | Frozen fields + bulk authoring                 | Done          | `e39836b` |
| 6       | Media pipeline (images + audio)                | Done          | `6f96042`, `55c6368` (review fixes) |
| 7       | TTS pronunciation                              | Done          | `0c4610a` |
| 8       | Image occlusion                                | **Next**      | -         |
| 9       | Drawing card type                              | Pending       | -         |
| 10      | FSRS scheduler + standard review               | Pending       | -         |
| 11      | Custom Study mode                              | Pending       | -         |
| 12      | Stats + history + graphs                       | Pending       | -         |
| 13      | Backup export / import                         | Pending       | -         |
| 14      | PWA polish + install flow + offline            | Pending       | -         |
| 15      | Accessibility + iPad QA + final polish         | Pending       | -         |
| 16      | Deploy to GitHub Pages + README                | Partial (deploy front-loaded; README still pending) | -         |

## Bugs caught in review and what they tell us

These are kept here as a reminder of what kinds of failures the code base
tends to ship. Future reviews should look for the same patterns.

- **Session 6 — storeMedia refCount leak.** `storeMedia` was inserting new
  rows with `refCount = 1` AND incrementing on existing rows, while
  `createCard` also called `retainMedia`. Every save permanently double-
  counted, and the GC sweep could never reclaim. Lesson: when two layers
  both touch refcount, exactly one owns it. Cards own refcount now.
- **Session 6 — audio safety-timer race.** The MediaRecorder "stop" event
  listener was registered lazily inside `stopAndCleanup()`. If the 15s
  safety timer fired first, the event dispatched with no listener, and the
  eventual user stop() awaited an event that would never fire again ->
  promise hangs forever. Lesson: register lifecycle event listeners at
  construction, not at "stop" time. Use a shared resolved promise.
- **Session 6 — preview gap.** McqPreview / TypedPreview only rendered
  text, not images / audio that were authored on the question / prompt
  RichField. Lesson: when widening a draft shape, check every consumer.
  Now there's a shared `RichFieldRender` helper, so future RichField
  consumers get the same render for free.

## Verification still needed (manual / on-device)

Items deferred to real-device QA:

- Session 3 deliverable: 3-level deck tree creation, move semantics, depth
  warning at level 5, reload persistence.
- Session 6 deliverable: image add (compresses to WebP, persists), audio
  record (15s cap, mic permissions, countdown), refCount sanity after
  card delete + reload.
- Session 7 deliverable: TTS quality on iPad with Enhanced French voice
  downloaded. Speaker icon plays the word; auto-speak hooks fire (Session
  10 will exercise these in the review session).

## Standing rules

**Plain-English user copy** (Playbook section 11 "Voice and copy"). Every user-visible string is read by a student, not a developer. Avoid implementation jargon (chip, propagate, cascade, sibling, endpoint, idempotent, refcount), coding terms (kebab-case, schema), and internal scheduling (Session N). Describe results, not mechanisms. The Playbook has a swap table of patterns to match.

## Open notes for the next session

- `package.json` still flags 3 moderate npm audit warnings on transitive
  deps; review at Session 14.
- Bundle currently 393 KB raw / 124 KB gzipped. Konva (Sessions 8-9) is
  the next big add and **must be lazy-loaded** per the playbook so the
  Konva chunk only loads when an occlusion or drawing route is visited.
- `src/srs/state.ts` wraps ts-fsrs with `initFsrsState()`. Session 10
  builds the full scheduler around this.
- All Dexie usage is confined to `src/db/`. Components must import from
  `../db` (or `@/db`), not from `dexie` directly.
- Cards own all media refcounts via createCard / updateCard / deleteCard /
  bulkCopyCardsToDeck / (deck) deleteDeck. `storeMedia` is idempotent and
  never touches refCount.
- The 14 react-refresh "only-export-components" warnings are dev-time only
  (fast-refresh boundary heuristics); they don't affect production.
