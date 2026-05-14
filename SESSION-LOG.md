# Session log

The single-file resumption brief. Clone the repo, read this file, and
you're caught up — current status, how to run the app, what's done,
what's next.

Commit messages hold the line-level detail. This file holds the
narrative.

---

## Status

**Where v1 stands:** every session in the original build plan is shipped
(sessions 1–14). The gamification layer (coins, ranks, themes, fonts,
unlock codes, shop) landed on top of that. Three rounds of iPad QA
have run; pass-1 and pass-2 fixes are in production. Live at
https://jshphysics.github.io/fantastic-flashcards/.

**Flashcard Survivors** (alt review mode, full spec in
`FantasticFlashcards-FlashcardSurvivors-Spec.md`) is in. Engine + 12
weapons + 12 Mastery Tree nodes + 3 difficulties + Keyboard and Tap
input modes + deck-select + run persistence all shipped. Lazy-loaded
as a 53 KB chunk so non-players don't pay for it. Needs QA — see
`QA-CHECKLIST.md`.

**What's left for a v1.0.0 tag:**

1. Round 3 retest on real devices (iPad + Android phone). See
   `QA-CHECKLIST.md` for the live retest list.
2. Accessibility pass (untested at all — Round 3 includes a checklist).
3. README polish for end-user audience (this commit ships a first cut).
4. Tag v1.0.0 once Round 3 is clean.

Deferred polish (drawing canvas Apple Pencil refinements, document-
photo crop / straighten, etc.) is logged in `QA-CHECKLIST.md` under
"Deferred". None is blocking the v1 release.

---

## Resume on a new machine

```
git clone https://github.com/JSHPhysics/fantastic-flashcards.git
cd fantastic-flashcards
npm install
npm run dev       # http://localhost:5173/fantastic-flashcards/
```

`npm run dev` serves the app with seeded dev data (2 decks × 5 cards).
To reset the local IndexedDB during dev, open DevTools and run
`window.__wipeDev()`; to re-seed, `window.__seedDev()`. The
`?reset-app=1` URL parameter also wipes everything and works in any
browser, dev or prod.

Build / typecheck / lint must stay green before each commit:

```
npm run typecheck
npm run lint
npm run build
```

Deploy is automatic: `.github/workflows/deploy.yml` builds on every
push to `main` and ships via GitHub Pages Actions. One-time repo
setup (already done): Settings → Pages → Source = **GitHub Actions**.

---

## Repo documents at a glance

| File | What it is | When to read |
|---|---|---|
| `README.md` | End-user / contributor front door | First, if you're new |
| `SESSION-LOG.md` | This file — current state + next steps | When resuming on a new machine |
| `QA-CHECKLIST.md` | Live retest items + deferred polish | Before a QA pass |
| `FantasticFlashcards-Playbook.md` | Full spec: data model, design system, every feature's contract | When designing or reviewing code |
| `FantasticFlashcards-BuildPlan.md` | Original 16-session brief (historical; v1 sessions complete) | For context on architectural decisions |
| `DESIGN-DECISIONS.md` | Rejected ideas with rationale | Before re-proposing a feature shape we've already discussed |

---

## What's next

In priority order:

### 1. Round 3 QA + accessibility pass

`QA-CHECKLIST.md` carries the live retest list. Cover:
- Modals across Android phone, iPhone, iPad portrait + landscape,
  desktop. Wipe-all dialog on Android specifically.
- Demo seed rank lands at Practitioner (~38% mature). Coin balance 300
  out of the box.
- Heatmap fits iPad portrait width without horizontal scroll.
- Subject-theme + paired-font auto-application (TEAMCS → Share Tech
  Mono, etc.).
- Service-worker recovery: `?reset-app=1` URL, 8-second watchdog,
  recovery panel.
- Accessibility (tab order, focus rings, ARIA labels, contrast in
  every premium theme).

### 2. Persistent storage on real device

Open in Safari → install to home screen → use for two or three days
across separate sessions → check Settings → Storage → "Persistent:
Yes". This is engagement-gated by the browser; can't be forced.

### 3. README polish round

The first cut shipped in this commit covers the basics. A second pass
should add:
- Screenshots of each major flow (home, study, stats, shop)
- Step-by-step "Add to home screen" walkthroughs for iOS Safari +
  Android Chrome with images
- A "What's the data story?" section linking to the Playbook's
  Privacy section

### 4. v1.0.0 tag + CHANGELOG

Once Round 3 passes:
```
git tag v1.0.0
git push --tags
```

`CHANGELOG.md` from v1.0.0 onwards documenting what shipped in each
release. The 25+ commits to date can be collapsed under a single
"Initial release" heading.

### 5. Deferred polish items

Logged in `QA-CHECKLIST.md` under "Deferred". Pull from this list
post-v1 as time + device access allow. Highlights:
- Apple Pencil per-point pressure variation (`sceneFunc` approach)
- Document-photo crop / straighten / deskew
- Eraser hit reticule
- Drawing-card take-photo preview black on iPad

---

## Standing rules

**Plain-English user copy** (Playbook section 11 "Voice and copy").
Every user-visible string is read by a student, not a developer. Avoid
implementation jargon (chip, propagate, cascade, sibling, endpoint,
idempotent, refcount), coding terms (kebab-case, schema), and internal
scheduling (Session N). Describe results, not mechanisms. The Playbook
has a swap table of patterns to match.

**Rejected ideas live in `DESIGN-DECISIONS.md`.** Before re-suggesting
a refactor or feature shape, skim that file. If the trade-off has
changed (e.g. data scale, new requirement), update the existing entry
rather than starting over.

**Code review after each session.** Don't build on bad code. A
rigorous self-review pass before moving on caught real bugs in
Session 6 (storeMedia refCount leak, audio safety-timer race, MCQ
preview gap) that would have shipped otherwise. Same discipline going
forward.

---

## Architectural invariants worth knowing

These are stable design rules current code relies on. Breaking them
without justification will cause subtle bugs.

- **Cards own all media refcounts.** `createCard` / `updateCard` /
  `deleteCard` / `bulkCopyCardsToDeck` / (deck) `deleteDeck` retain
  and release media. `storeMedia` is idempotent and never touches
  refCount. The sweep on profile load reclaims orphans.
- **Dexie usage is confined to `src/db/`.** Components import from
  `../db` (or `@/db`), not from `dexie` directly. Same for the new
  gamification modules — DB access goes through repositories.
- **Konva is lazy-loaded.** Occlusion editor, drawing editor, and the
  drawing-card review canvas are all dynamic-imported so the ~290 KB
  Konva chunk only loads on routes that need it.
- **Theme colours are CSS variables.** Tailwind tokens (`bg-cream`,
  `text-navy/30`, etc.) resolve to `rgb(var(--color-X) / alpha)`. Any
  theme can override the palette without touching utility classes.
  See `src/index.css` for the variable definitions.
- **Gamification state lives in `ProfileSettings`.** Coins, unlocked
  themes/fonts, redeemed codes, today's coin bucket, last known rank
  — all on `profile.settings`. The backup file round-trips the full
  profile, so gamification state survives backup/restore for free.
- **The 17 `react-refresh/only-export-components` warnings** are
  dev-time only (fast-refresh boundary heuristics). They don't affect
  production. Ignore unless a real lint error appears.

---

## Bug-pattern reminders

Kept as a record of failure modes this codebase tends to ship. Future
reviews should look for the same patterns.

- **Two layers touching one piece of state.** Session 6's media-refcount
  leak: `storeMedia` and `createCard` both bumped the refcount. Rule:
  exactly one owner per piece of state.
- **Lifecycle event listeners registered lazily.** Session 6's audio
  safety-timer race: the "stop" listener was attached only when
  `stopAndCleanup()` was called. If a safety timer fired first, the
  event went nowhere and the eventual user stop awaited forever.
  Register lifecycle listeners at construction.
- **Widening a draft shape without checking every consumer.** Session 6
  again: when RichField gained images + audio, the MCQ and Typed
  previews didn't render them. Now there's a shared `RichFieldRender`
  helper so new consumers get the same render for free.
- **`position: fixed` inside a `flex` parent.** The original Dialog had
  this — the parent's alignment classes did nothing because fixed
  children leave flex flow, and positioning fell through to brittle
  per-variant top/inset math that diverged across browsers. Rewrite
  used flex flow throughout.
- **Stable indexing in seed lookups.** The first version of the
  mature-cards seed pass queried by parent-deck id, but cards live in
  sub-decks — the parent decks had zero cards. Sub-deck lookup or
  flat-everything queries are the safe defaults.
- **`interactive-widget=resizes-content` on Android.** Dragged the
  bottom tab bar up with the keyboard. The `dvh` units already handle
  modal sizing without needing the viewport hint — net cost,
  reverted.
