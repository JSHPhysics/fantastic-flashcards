# Session 15 — iPad QA + final-polish checklist

Live URL: https://jshphysics.github.io/fantastic-flashcards/. Hard-refresh
the first time you open it after a deploy (the service worker can hold
an older build).

**Useful shortcuts**

- Settings → Debug mode → "Generate sample decks" — drops the `[demo]` set
  with two weeks of made-up review history.
- Codes tab: `LEHS2025` unlocks all themes + fonts. `COINMAX` (dev build
  only) jumps the balance to 9999. `RESETALL` (dev only) wipes
  gamification state but keeps decks/cards.
- To start clean: Settings → Debug → "Wipe all local data".

Tick a box once you've confirmed the item works on the device you're
testing on. Use the **Notes** block under each section to flag anything
that surprised you, anything outside the checklist, or anything that
needs a follow-up commit.

---

## 1. Install + first launch

- [ ] Safari → Share → **Add to Home Screen** picks up the icon correctly
- [ ] Launched from the home-screen icon opens **standalone** (no Safari chrome)
- [ ] Works **fully offline** after first load (Airplane Mode → force-quit → relaunch)
- [ ] Safe-area insets respected top + bottom (no content under the notch or home indicator)
- [ ] Bottom tab bar sits above the home indicator
- [ ] Status bar tint matches the active theme

### Notes
-
-

---

## 2. Deck management (Session 3 debt)

- [ ] Create a 3-level deck tree (root → child → grandchild)
- [ ] Move a sub-deck under a different parent — card counts on both ancestors update
- [ ] Try to create a 5th-level sub-deck — depth warning fires, Continue still works
- [ ] Reload — tree state, expansion, names persist
- [ ] Delete a sub-deck — children + cards go with it; media GC sweeps on next launch

### Notes
-
-

---

## 3. Card authoring (Session 4 + 5)

- [ ] Create one of each card type: Basic, Cloze (`{{c1::...}}`), MCQ, Typed
- [ ] On-screen keyboard doesn't cover the active input
- [ ] Frozen-field locks: lock deck/tags/type, create three cards in a row, see them retained
- [ ] Cloze with `{{c2::...}}` generates two separate review cards
- [ ] Auto-reverse on Basic: creates exactly one reverse sibling; turning it off cascade-deletes the sibling

### Notes
-
-

---

## 4. Media pipeline (Session 6 debt)

- [ ] Add image via **paste** (Cmd-V / clipboard paste)
- [ ] Add image via **upload** (file picker)
- [ ] Add image via **take photo** (camera, document mode, white-balance)
- [ ] Record audio — 15-second cap, countdown, mic permission first time
- [ ] Save card, reload — image + audio still attached
- [ ] Accent-letter pills appear when the card has a language set
- [ ] Delete a card with media → reload → in DevTools, `await db.media.toArray()` shows the orphaned rows are gone (refCount=0 cleanup)

### Notes
-
-

---

## 5. TTS pronunciation (Session 7 + the baseLanguage redirect)

Prep: iPad Settings → Accessibility → Spoken Content → Voices → download
an Enhanced voice for French.

- [ ] Speaker icon on the French side reads French; English side reads English (right voices, not the wrong-accent fallback)
- [ ] Auto-speak on show / auto-speak on reveal toggles work independently
- [ ] **Reverse-card test:** on a reversed card (English front), with deck `baseLanguage = en-GB` set, auto-speak still reads the **French** side
- [ ] Settings → "Use Google online voices" on → speaker plays Google voice (needs network); off → falls back to device voice

### Notes
-
-

---

## 6. Image occlusion (Session 8)

- [ ] Import an image, draw a few **rectangle** masks via drag
- [ ] Draw a few **ellipse** masks
- [ ] Drag a mask to move; use Transformer handles to resize
- [ ] "Done drawing" releases the canvas — page below scrolls past normally
- [ ] In review: tapping a hidden mask reveals it; rating buttons work

### Notes
-
-

---

## 7. Drawing card (Session 9)

- [ ] Apple Pencil stroke: width responds to **pressure at pointerdown** (v1 behaviour — per-point pressure is deferred)
- [ ] Eraser feels responsive (no laggy jumps)
- [ ] Palm rejection: strokes don't appear under a resting palm while Pencil is active
- [ ] In review: prompt + canvas show; "Show Answer" reveals model in chosen mode (overlay / side-by-side / toggle)
- [ ] Self-rate → drawing discarded → next card

### Notes
-
-

---

## 8. Study session + scheduler (Session 10)

- [ ] Start a standard session on a deck with mixed new + due cards
- [ ] FSRS rating buttons all fire; next-due dates advance visibly
- [ ] Auto-reverse pairs **don't land adjacent** in the queue (shuffle-within-bucket fix)
- [ ] Session timer counts up in the top bar when enabled
- [ ] Exit confirm appears if ≥1 card rated; instant exit otherwise
- [ ] Session summary: cards reviewed, accuracy %, time, rating breakdown chart

### Notes
-
-

---

## 9. Custom study (Session 11)

- [ ] Open Custom Study, pick multiple decks + tag filter + type filter
- [ ] "Update spaced repetition" off → FSRS state unchanged after session; ReviewEvents still recorded
- [ ] "Update spaced repetition" on → FSRS state updates as normal
- [ ] Max-cards limit is respected

### Notes
-
-

---

## 10. Stats (Session 12)

(With the demo seed installed.)

- [ ] Today / This Week / All Time tabs each render
- [ ] Week-chart bars match heatmap cells for the same dates
- [ ] Tap a bar / heatmap cell → "Sessions on \<date\>" drill-down opens with correct sessions
- [ ] Streak chip + rest-day indicator render correctly
- [ ] **Rank card** at top shows icon + label + mastery %
- [ ] **Coin balance pill** shows "(N left today)"

### Notes
-
-

---

## 11. Gamification — coins, ranks, themes, fonts, codes (NEW)

- [ ] Review a card → coin balance increases by 1
- [ ] Review the **same card again** the same day → balance stays put
- [ ] Rate Good or Easy on the first review of the day → balance gets +2
- [ ] Finish a standard session's deck queue → +5 deck-complete bonus fires once
- [ ] After 25 coins today, the next review awards 0 (cap enforced)
- [ ] Cross a rank threshold → rank-up dialog appears with confetti, message, icon
- [ ] Dialog overlays the session summary (not the active card view) — confetti visible against it
- [ ] Dismissing dialog returns to summary; same session doesn't re-fire the dialog on re-entry
- [ ] Settings → Look & feel → "Open theme & font shop"
- [ ] **Themes tab:** tap a free theme — UI re-tints across all surfaces
- [ ] Try to buy a paid theme with insufficient coins → friendly message, no purchase
- [ ] With enough coins → buy confirms, balance drops, theme applies + shows Owned
- [ ] **Fonts tab:** each font name renders in that font (Google Fonts loads on demand); tap one and body font changes
- [ ] **Codes tab:** redeem `TH7X2Q` → Ocean appears as Owned; redeem again → silent "Already redeemed"
- [ ] Redeem `TEAMPHYSICS` → both Physics themes + Share Tech Mono unlock; subject themes now appear in shop
- [ ] Redeem `THESTAFFROOM` → reference panel lists every code
- [ ] Redeem `LEHS2025` → every theme + font flips to Owned
- [ ] Redeem `COINMAX` (dev only) → balance jumps to 9999
- [ ] In production build (`npm run build && npm run preview`), debug codes return "doesn't match anything"

### Notes
-
-

---

## 12. Checkboxes + radio inputs (recent fix)

- [ ] **Dark mode:** every checkbox in the app (Settings toggles, MCQ "correct?", custom-study filters, camera document mode, Quizlet auto-reverse) is clearly visible unchecked AND has a high-contrast tick when checked
- [ ] **Light mode:** same — navy box, cream tick
- [ ] Radios (Quizlet target deck, native-language picker) have matching treatment with inner-dot

### Notes
-
-

---

## 13. Layout responsiveness (recent fix)

- [ ] iPad portrait (~768px): content max-width 4xl fits comfortably; two-column shop tabs work
- [ ] iPad landscape (~1024px): content at 4xl, plenty of side margin
- [ ] iPhone portrait (~390px): headings 2xl (not 3xl); DeckRow chip cluster wraps; media-size pill hidden
- [ ] Desktop ≥1280px (xl): main content stretches to 5xl; bottom tab bar matches width

### Notes
-
-

---

## 14. Backup round-trip

- [ ] Settings → Export backup → downloads `.flashcards` file (or share sheet on iPad)
- [ ] "Last backup" updates to "Just now"
- [ ] Wipe all local data → reload → import the backup file
- [ ] Diff preview shows correct deck / card / review / session / media counts
- [ ] After import: decks, cards, image + audio media, review history, **coin balance**, **unlocked themes**, **unlocked fonts**, **unlocked codes**, **active theme + font** all restore

### Notes
-
-

---

## 15. Update banner + persistence

- [ ] Push a code change → on the live app a new SW installs, **update banner** appears with "Refresh to apply"
- [ ] Refresh applies the new version
- [ ] Settings → Storage → "Persistent: Yes" after a few days of use (or after tapping "Request now" + a deferred grant)

### Notes
-
-

---

## 16. Accessibility (Session 15 proper)

- [ ] Tab through every focusable control in home / deck detail / card editor / study session / shop / settings — focus ring (navy or gold per theme) visible at every stop
- [ ] Esc closes every Dialog (Shop, Confirm, RankUp, ImportConfirm, CreateDeck, etc.)
- [ ] `aria-label` on icon-only buttons reads sensibly in VoiceOver (FAB, dialog close, expand/collapse, dismiss banner)
- [ ] Each page has exactly one h1, h2s underneath
- [ ] Reduced-motion on (Settings → Accessibility → Reduce Motion): confetti runs instantly or not at all; no animation churn
- [ ] Colour contrast in every theme: body text vs background ≥ 4.5:1 (spot-check Neon and Volcanic with WebAIM)
- [ ] Touch targets ≥ 44pt (spot-check Stats tab pills, theme/font shop rows)

### Notes
-
-

---

## 17. Final-polish bugs to look out for

- [ ] No stale Google Fonts CSS cached by the service worker (Network tab → switch fonts, each new font triggers a fresh stylesheet request)
- [ ] No console errors on cold launch (DevTools → Console)
- [ ] No CSS variables resolving to broken syntax like `rgb( / 1)` (inspect body, headings, ink-* usages)
- [ ] iOS Safari zoom-on-focus: every input is `text-base` (16px) so iOS doesn't zoom in
- [ ] Auto-rotate portrait ↔ landscape mid-session doesn't reset the card or lose state

### Notes
-
-

---

## Cross-cutting notes

Anything that doesn't fit into a single section — patterns you notice
across multiple flows, design feedback, "by the way" thoughts, etc.

-
-
-
