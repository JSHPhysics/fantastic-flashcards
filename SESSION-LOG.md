# Session log

Tracks build-plan progress so any device (or any fresh Claude Code session) can
pick up without context. Keep entries terse; commit messages hold the detail.

---

## Status

**Last completed:** Session 3 — deck management with sub-decks
**Next up:** Session 4 — card editor for text-based card types (Basic, Cloze, MCQ, Typed)
**Stopped at:** Session 3 committed and pushed; Session 4 not yet started. Todo
list for Session 4 was sketched then discarded when work paused.

## Resume on a new machine

```
git clone https://github.com/JSHPhysics/fantastic-flashcards.git
cd fantastic-flashcards
npm install
npm run dev       # http://localhost:5173/fantastic-flashcards/
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
| 4       | Card editor: Basic, Cloze, MCQ, Typed          | **Next**      | -         |
| 5       | Frozen fields + bulk authoring                 | Pending       | -         |
| 6       | Media pipeline (images + audio)                | Pending       | -         |
| 7       | TTS pronunciation                              | Pending       | -         |
| 8       | Image occlusion                                | Pending       | -         |
| 9       | Drawing card type                              | Pending       | -         |
| 10      | FSRS scheduler + standard review               | Pending       | -         |
| 11      | Custom Study mode                              | Pending       | -         |
| 12      | Stats + history + graphs                       | Pending       | -         |
| 13      | Backup export / import                         | Pending       | -         |
| 14      | PWA polish + install flow + offline            | Pending       | -         |
| 15      | Accessibility + iPad QA + final polish         | Pending       | -         |
| 16      | Deploy to GitHub Pages + README                | Pending       | -         |

## Verification still needed (manual / on-device)

Session 3's deliverable check is interactive and hasn't been clicked through on
a real device yet. Before relying on the deck flows for further work, on first
resume:

- Create a 3-level deck tree from the home FAB; reload; confirm the tree
  persists.
- Open deck overflow menu: try Rename, Duplicate (verify the copied subtree has
  new ids, copied cards, and resets FSRS), Move (verify the picker excludes the
  deck and its descendants), Delete (verify recursive cascade).
- Build a deeper nest: confirm the depth-warning modal fires at level 5.

If any of those reveal a bug, fix in Session 3 before Session 4.

## Open notes for the next session

- `package.json` still flags 3 moderate npm audit warnings on transitive deps
  (deferred — they're build-time deps, not runtime). Re-check at Session 14.
- Bundle currently 341 KB raw / 111 KB gzipped, well under the 600 KB gzipped
  target for the app shell. Konva (Sessions 8-9) is the next big add and must
  be lazy-loaded per the playbook.
- Dev seed lives in `src/db/seed.ts` and skips when decks already exist. Wipe
  via `window.__wipeDev()` if you want a clean slate.
- `src/srs/state.ts` wraps `ts-fsrs` with `initFsrsState()`. Session 10 builds
  the rest of the scheduler around this.
- All Dexie usage is confined to `src/db/`. Components must import from
  `@/db` (or `../db`), not from `dexie` directly.
