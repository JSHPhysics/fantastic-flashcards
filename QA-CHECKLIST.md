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

- [x] Safari → Share → **Add to Home Screen** picks up the icon correctly
- [x] Launched from the home-screen icon opens **standalone** (no Safari chrome)
- [x] Works **fully offline** after first load (Airplane Mode → force-quit → relaunch)
- [x] Safe-area insets respected top + bottom (no content under the notch or home indicator)
- [x] Bottom tab bar sits above the home indicator
- [x] Status bar tint matches the active theme

### Notes


-

---

## 2. Deck management (Session 3 debt)

- [x] Create a 3-level deck tree (root → child → grandchild)
- [x] Move a sub-deck under a different parent — card counts on both ancestors update
- [x] Try to create a 5th-level sub-deck — depth warning fires, Continue still works
- [ ] Reload — tree state, expansion, names persist
- [x] Delete a sub-deck — children + cards go with it; media GC sweeps on next launch

### Notes
- When trying to move decks, the bottom most deck in the list cannot have its menu opened because in portrait orientation on the ipad it overlaps the + button.
- On the home screen, the state of trees (expanded or hidden) does not persist across refreshes.
- When creating a deck in landscape the modal goes off the bottom of the screen, and can't be saved because it is too difficult to click the button offscreen. This modal should either be smaller, or scrollable. I'd favor less-is-more here. Perhaps have a portrait and landscape layout of the modal? We should consider this for all pages and modals going forward.
- Often when tapping textboxes a white bar appears in the middle, or bottom of screen. It has a password manager icon, card and location icons on the right. It seems to have z precedence over the app and prevents inputs, it is very annoying.

---

## 3. Card authoring (Session 4 + 5)

- [x] Create one of each card type: Basic, Cloze (`{{c1::...}}`), MCQ, Typed
- [x] On-screen keyboard doesn't cover the active input
- [x] Frozen-field locks: lock deck/tags/type, create three cards in a row, see them retained
- [x] Cloze with `{{c2::...}}` generates two separate review cards
- [x] Auto-reverse on Basic: creates exactly one reverse sibling; turning it off cascade-deletes the sibling

### Notes

---

## 4. Media pipeline (Session 6 debt)

- [x] Add image via **paste** (Cmd-V / clipboard paste)
- [x] Add image via **upload** (file picker)
- [x] Add image via **take photo** (camera, document mode, white-balance)
- [x] Record audio — 15-second cap, countdown, mic permission first time
- [x] Save card, reload — image + audio still attached
- [x] Accent-letter pills appear when the card has a language set
- [ ] Delete a card with media → reload → in DevTools, `await db.media.toArray()` shows the orphaned rows are gone (refCount=0 cleanup)

### Notes
- I can't see a devTools section to check, perhaps in the debug section you should include a display of anything like this that you wish for me to check.


---

## 5. TTS pronunciation (Session 7 + the baseLanguage redirect)

Prep: iPad Settings → Accessibility → Spoken Content → Voices → download
an Enhanced voice for French.

- [x] Speaker icon on the French side reads French; English side reads English (right voices, not the wrong-accent fallback)
- [x] Auto-speak on show / auto-speak on reveal toggles work independently
- [x] **Reverse-card test:** on a reversed card (English front), with deck `baseLanguage = en-GB` set, auto-speak still reads the **French** side
- [x] Settings → "Use Google online voices" on → speaker plays Google voice (needs network); off → falls back to device voice

### Notes
- Make the google voice the default without students having to choose it manually in the settings.
---

## 6. Image occlusion (Session 8)

- [x] Import an image, draw a few **rectangle** masks via drag
- [ ] Draw a few **ellipse** masks
- [x] Drag a mask to move; use Transformer handles to resize
- [x] "Done drawing" releases the canvas — page below scrolls past normally
- [x] In review: tapping a hidden mask reveals it; rating buttons work

### Notes
4. When drawing an occlusion card, the ellipse doesn't grow when dragged, effectively it cannot be drawn. One input mode we might consider for uniform shapes is touch and hold with the pen (to scale the shape out from where the pen is touched).

5. It is difficult to edit larger images using the interface, you have to scroll to find the bottom of the image which means you can't select the occlusion shape.

---

## 7. Drawing card (Session 9)

- [ ] Apple Pencil stroke: width responds to **pressure at pointerdown** (v1 behaviour — per-point pressure is deferred)
- [x] Eraser feels responsive (no laggy jumps)
- [x] Palm rejection: strokes don't appear under a resting palm while Pencil is active
- [ ] In review: prompt + canvas show; "Show Answer" reveals model in chosen mode (overlay / side-by-side / toggle)
- [ ] Self-rate → drawing discarded → next card

### Notes
- When adding an image as background, take photo preview only shows a black screen even with camera permissions allowed. When you take the photo itself, it does do the correct photo, but the user can't actually see what photo they're taking. This error seems to be unique on the drawing cards creation page, the camera preview works on the basic cards.
- The user needs to be able to crop the image, especially for document photos to be effective we need to be able to crop and align/straighten/angleadjust automatically, like how Microsoft Lens works.
- When using the pencil to draw and tap in the drawing area, sometimes the entire drawing area becomes selected which is never the intention
- When I try to tap clear all with the pen, it selects instead of registering a tap. This is a frustrating user experience.
- Pencil doesn't seem to respond to pressure, it draws, but no thickness/angle recognition as far as I can tell.
- Eraser feels smooth but its hard to see what you're going to erase, give a circle the size of the eraser under the pen when it it erasing, essentially a targeting reticule.


---

## 8. Study session + scheduler (Session 10)

- [x] Start a standard session on a deck with mixed new + due cards
- [x] FSRS rating buttons all fire; next-due dates advance visibly
- [x] Auto-reverse pairs **don't land adjacent** in the queue (shuffle-within-bucket fix)
- [x] Session timer counts up in the top bar when enabled
- [x] Exit confirm appears if ≥1 card rated; instant exit otherwise
- [x] Session summary: cards reviewed, accuracy %, time, rating breakdown chart

### Notes
-Draw X cards don't actually provide a drawing pane, and they don't seem to load the model answer when you tap to. This is weird, the question says "draw on paper or in your head", but when making the card there is an option for how to display the answer "switch back and forth, side by side or overlay" - We need a drawing pane in study window.
-

---

## 9. Custom study (Session 11)

- [x] Open Custom Study, pick multiple decks + tag filter + type filter
- [ ] "Update spaced repetition" off → FSRS state unchanged after session; ReviewEvents still recorded
- [ ] "Update spaced repetition" on → FSRS state updates as normal
- [ ] Max-cards limit is respected

### Notes
- for the update FSRS you'll need to give me a display to show if it has or hasn't updated. Also we should have custom sessions update the fsrs schedule by default, practice is practice. Unless you have a source that shows why we shouldn't do that?
-

---

## 10. Stats (Session 12)

(With the demo seed installed.)

- [x] Today / This Week / All Time tabs each render
- [x] Week-chart bars match heatmap cells for the same dates
- [x] Tap a bar / heatmap cell → "Sessions on \<date\>" drill-down opens with correct sessions
- [x] Streak chip + rest-day indicator render correctly
- [x] **Rank card** at top shows icon + label + mastery %
- [x] **Coin balance pill** shows "(N left today)"

### Notes
-Tap bar shows data, however, it would be good to show what topics were practice.
- Heatmap blips are very small on ipad, hard to tap accurately.
- Rank card shows but demo data doesn't have any mastered cards so it only shows unranked. Tapping it should show ranks students can earn.
- Coin pill shows how many left, and current balance.

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
- [x] Settings → Look & feel → "Open theme & font shop"
- [x] **Themes tab:** tap a free theme — UI re-tints across all surfaces
- [x] Try to buy a paid theme with insufficient coins → friendly message, no purchase
- [ ] With enough coins → buy confirms, balance drops, theme applies + shows Owned
- [x] **Fonts tab:** each font name renders in that font (Google Fonts loads on demand); tap one and body font changes
- [x] **Codes tab:** redeem `TH7X2Q` → Ocean appears as Owned; redeem again → silent "Already redeemed"
- [x] Redeem `TEAMPHYSICS` → both Physics themes + Share Tech Mono unlock; subject themes now appear in shop
- [x] Redeem `THESTAFFROOM` → reference panel lists every code
- [x] Redeem `LEHS2025` → every theme + font flips to Owned
- [ ] Redeem `COINMAX` (dev only) → balance jumps to 9999
- [x] In production build (`npm run build && npm run preview`), debug codes return "doesn't match anything"

### Notes
1. Can't check coins from demo data because demo data loads with no coin allocation left.
2. Need demo data update to allow checks of some things. Have a debug page I can use to simply fire each of these tests.
3. Coinmax code doesn't work so I can't test purchasing.
4. No sure how to test this (npm run build && npm run preview), you can test that.

---

## 12. Checkboxes + radio inputs (recent fix)

- [x] **Dark mode:** every checkbox in the app (Settings toggles, MCQ "correct?", custom-study filters, camera document mode, Quizlet auto-reverse) is clearly visible unchecked AND has a high-contrast tick when checked
- [x] **Light mode:** same — navy box, cream tick
- [x] Radios (Quizlet target deck, native-language picker) have matching treatment with inner-dot

### Notes
-
-

---

## 13. Layout responsiveness (recent fix)

- [ ] iPad portrait (~768px): content max-width 4xl fits comfortably; two-column shop tabs work
- [ ] iPad landscape (~1024px): content at 4xl, plenty of side margin
- [ ] iPhone portrait (~390px): headings 2xl (not 3xl); DeckRow chip cluster wraps; media-size pill hidden
- [x] Desktop ≥1280px (xl): main content stretches to 5xl; bottom tab bar matches width

### Notes
- In portrait, modals seem to go off the bottom of the screen. Top margin is large, same for side margins.
- In landscape mode, modal is also off bottom of screen, when scrolling it stays so.
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
