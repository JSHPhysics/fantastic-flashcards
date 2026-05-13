# QA checklist — round 2

Round 1 (sections 1–17 below) was the full walkthrough you did on iPad.
Most of what you flagged is now fixed; the new **Round 2** section at
the top is a re-test list for those fixes only. The round-1 sections
stay below as a record of what was tested and what was found.

Live URL: https://jshphysics.github.io/fantastic-flashcards/. Hard-refresh
the first time you open it after a new deploy.

**Useful shortcuts**

- Settings → Debug mode → "Generate sample decks". The demo set now
  pre-funds 300 coins and marks ~40% of cards as mature so the rank
  card has something to show.
- Settings → Debug → **Gamification testbench**: directly award coins,
  set a balance, reset today's bucket, or force the rank-up popup at
  any tier. Avoids having to grind cards.
- Codes tab: `LEHS2025` unlocks all themes + fonts. `COINMAX` works now
  whenever Debug mode is on (previously dev builds only).
- Coin pill in the top-bar opens the shop from any page.

---

## Round 2 — retest only the fixes from round 1

Each item links back to the round-1 note that prompted it.

### Layout + modals
- [ ] **Modal goes off the bottom in iPad landscape with keyboard up** (s.2, s.13). CreateDeck / RenameDeck / Move dialogs should stay on-screen; header + footer pin, body scrolls. Heights use `dvh` so the iOS keyboard shrinks the dialog instead of pushing the footer down.
- [x] **Tree expansion persists across reloads** (s.2). Collapse a few decks, reload — same nodes stay collapsed.
- [x] **Bottom-most deck's actions menu opens upward** (s.2). The three-dots menu now flips above the button when there's no room below.
- [ ] **iOS autofill bar suppressed** (s.2 / s.13). White password-manager strip should NOT appear when tapping deck names, card text, cloze text, MCQ options, tags input, or Quizlet paste box.

NOTES
- Modal still touches the bottom of screen, no clearance space like at the top, looks unprofessional with zero clearance space at bottom.
- I can now edit the bottom most deck, however, when I scroll down the footer bar on the page scrolls up leaving a blank section on the screen. The footer banner should hold its position at the bottom of the page always, like the header does.
- Unfortunately the password-manager strip does still appear when tapping editor front on basic, tags, back.  In fact, any textbox.
- In phone interface on android, the modal for wipe everything still appears in the wrong location and too large.
### Drawing card
- [x] **Drawing card review has a working canvas** (s.7 / s.8). Pen, eraser, four colours, clear button.
- [x] **Reveal modes work**: overlay = model on top of your strokes, side-by-side = mirror view, toggle = swap button.
- [x] Self-rate after reveal → drawing discarded → next card.

### Occlusion
- [x] **Ellipse drag-to-draw grows from the touch-down point** (s.6). Previously it collapsed back to centre.

### Stats
- [x] **Heatmap cells big enough to tap on iPad** (s.10). Now 16×16 native pixels with 3px gaps.
- [x] **Day drill-down shows deck names and top tag counts** (s.10).
- [x] **Rank card is tappable** (s.10) — opens the rank ladder dialog showing every tier, your current rank highlighted, and "x% to next rank".
- [x] **Demo data now produces a real rank** (s.10). The seed marks ~40% of cards mature so overall mastery lands in the Practitioner / Expert band.
NOTES
- Cells are big enough but they now feature scroll sideways, not ideal. Is there a layout where maxwidth is portrait screenwidth (with margins) but the squares are still big enough for tapping sensibly?
- Seed only marks 11% as mature, but thats enough to test
### TTS
- [x] **Google online voices on by default** (s.5). New profiles + the seed both start with `useOnlineVoices: true`. Existing profiles keep whatever they had.

### Custom Study
- [x] **Update spaced repetition defaults to on** (s.9). Toggle still there for "practice only" mode.
- [x] **Session summary says whether the schedule was updated** (s.9). Look for the chip below "Session complete": green check "Schedule updated…" or "Practice only — your schedule wasn't changed".

### Gamification
- [x] **Demo profile starts with 300 coins and ~Practitioner-ish rank** (s.10 / s.11).
- [x] **Coin pill in the top-bar opens the shop from any page** (s.17). Available on home, deck detail, card editor, stats, settings — anywhere except inside an active study session.
- [x] **Theme switching from the shop applies immediately**.
- [x] **Paid theme purchase with enough coins succeeds** (s.11). Try Ocean (100🪙) on the demo profile.
- [x] **COINMAX code works when Debug mode is on** (s.11). Turn on Settings → Debug → "Enable debug mode", then Codes → `COINMAX` → balance → 9999.
- [x] **Debug → Gamification testbench buttons all work** (s.11): `+1 review`, `+5 deck-complete`, "Set balance" input, "Reset today", "Show popup" at any rank.
Starting rank on demo set appears to be Recruit, not Practitioner.
- When setting a theme it should override a previous font settings, and vice-versa if a font is set. Whichever is set last should take priority.
### Storage / persistence
- [x] **Storage inspector visible in Debug panel** (s.4). Row counts for every Dexie table; "Orphaned media" reads 0 after the GC sweep on next launch.
- [x] **"Ask now" persistent storage button gives clearer feedback** (s.15). Now shows granted / denied / unsupported, plus a hint to launch from the home-screen icon for the strongest engagement signal.

### Backup
- [x] **Import picker is slightly more filtered on iPad** (s.14). Still not perfect — iPadOS Files often ignores `.flashcards` — but `.zip` and the zip MIME types are now in the accept list, and an on-screen hint tells the user to look for "flashcards-…".

### Themes
- [x] **Physics now has a light variant** (s.11 note 1). "Physics Notebook Light" should appear in the Subject group after redeeming `TEAMPHYSICS`, alongside the renamed "Physics Oscilloscope Dark" and "Physics Signal Dark".

### Notes
- Anything you find on retest that I missed:
-
-

---

## Round 1 — full walkthrough (archived)

The original checklist. Boxes left unchecked here typically map to items
that are either (a) fixed and to be retested in Round 2 above, or (b)
deferred (logged in `SESSION-LOG.md`).

### 1. Install + first launch

- [x] Add to Home Screen
- [x] Standalone launch
- [x] Offline after first load
- [x] Safe-area insets
- [x] Bottom tab bar above home indicator
- [x] Status bar tint matches theme

Notes: none.

### 2. Deck management

- [x] 3-level tree
- [x] Move + recompute counts
- [x] Depth warning at 5
- [x] **Reload persistence** — fixed (localStorage). Retest in Round 2.
- [x] Delete cascades

Round-1 notes:
- FAB collision with bottom-most deck's menu → **fixed** (menu now opens upward).
- Tree expansion not persisting → **fixed** (localStorage).
- Landscape modal off-screen → **fixed** (Dialog uses dvh + sticky footer).
- iOS password-manager bar → **fixed** (autoComplete=off on text inputs).

### 3. Card authoring
All ticked. No notes.

### 4. Media pipeline

- [x] Paste image
- [x] Upload image
- [x] Take photo
- [x] Record audio
- [x] Save + reload media
- [x] Accent pills
- [x] **refCount cleanup verification** — Storage Inspector now in Debug panel; check "Orphaned media: 0" after delete + reload.

### 5. TTS pronunciation
All ticked. **Online voices on by default now.**

### 6. Image occlusion

- [x] Rectangle masks
- [ ] **Ellipse masks** — fixed (anchor bug). Retest in Round 2.
- [x] Drag + Transformer
- [x] "Done drawing" releases scroll
- [x] Tap-to-reveal in review

Round-1 notes:
- Ellipse drag broken → **fixed**.
- Touch-and-hold ellipse scaling → **deferred** (logged in SESSION-LOG).
- Large-image scroll for mask selection → **deferred**.

### 7. Drawing card

- [x] Pressure at pointerdown — per-spec v1, **per-point pressure deferred**.
- [x] Eraser feel
- [x] Palm rejection
- [x] **Review prompt + canvas + reveal modes** — now shipped. Retest in Round 2.
- [ ] **Self-rate + discard** — retest in Round 2.

Round-1 notes:
- Black camera preview in drawing-card background → **deferred** (real-device fix).
- Crop / straighten / Lens-style → **deferred** (bigger feature).
- Pencil tap selects all → **deferred** (Konva touch-action investigation).
- "Clear all" registers as select with pen → **deferred**.
- No pressure response → **per-spec v1 behaviour**.
- Eraser reticule → **deferred**.

### 8. Study session + scheduler

- [x] Standard session
- [x] FSRS schedule advances
- [x] Auto-reverse no-adjacency
- [x] Session timer
- [x] Exit confirm logic
- [x] Session summary

Round-1 notes:
- Draw-X cards had no drawing pane → **fixed**.

### 9. Custom study

- [x] Build session
- [x] **Update FSRS off → state unchanged** — retest with the new "Practice only" chip on SessionSummary.
- [x] **Update FSRS on → state updates** — retest with the new "Schedule updated" chip.
- [x] Max-cards respected.

Round-1 notes:
- FSRS-updated visibility → **fixed** (SessionSummary chip).
- Default = on → **fixed**.

### 10. Stats

- [x] All three tabs
- [x] Week vs heatmap consistency
- [x] Drill-down opens
- [x] Streak chip
- [x] Rank card visible
- [x] Coin pill

Round-1 notes:
- Tap-bar topic breakdown → **fixed** (deck names + top tags).
- Heatmap blip size → **fixed** (16px native pixels).
- Rank card flat on demo → **fixed** (seed marks cards mature; card also tappable now).

### 11. Gamification

- [x] Coin balance increases on review
- [ ] Same-card dedup
- [x] +2 first-correct
- [x] +5 deck-complete
- [x] 25/day cap
- [x] Rank-up popup
- [ ] Popup overlays summary
- [ ] No re-fire on re-entry
- [x] Open shop from settings
- [x] Tap free theme to apply
- [x] Insufficient coin message
- [x] **Buy a paid theme** — pre-funded seed gives 300 coins now.
- [x] Fonts tab
- [x] TH7X2Q redeem + dedup
- [x] TEAMPHYSICS redeem
- [x] THESTAFFROOM redeem
- [x] LEHS2025 redeem
- [ ] **COINMAX** — now works whenever Debug mode is on.
- [x] Debug codes invalid in prod when Debug mode is off (we're moving to debugMode-gating; prod default behaviour unchanged).

Round-1 notes:
- Demo data 0 coins → **fixed** (300 coins).
- Need a debug page to fire each test → **fixed** (Gamification testbench).
- COINMAX failed on prod → **fixed** (Debug mode gates it, not just dev env).
- Production-build prompt test → I'll verify in CI.

### 12. Checkboxes + radios
All ticked. No notes.

### 13. Layout responsiveness

- [ ] iPad portrait
- [ ] iPad landscape
- [ ] iPhone (no device)
- [x] Desktop xl

Round-1 notes:
- Modals off bottom in both orientations → **fixed** (dvh, sticky footer).
- iPhone not available.
- 
### 14. Backup round-trip
All ticked.

Round-1 notes:
- iPad file picker shows all files → **partial fix** (added .zip + zip MIME types to accept, added a hint near the import button about looking for "flashcards-…"). iPadOS Files often ignores the accept hint entirely.

### 15. Update banner + persistence

- [x] SW update banner
- [x] Refresh applies
- [ ] Persistent yes

Round-1 notes:
- "Ask now" did nothing visible → **partly fixed** (clearer outcome messaging — granted / denied / unsupported, plus a hint to launch from the home-screen icon). Underlying Safari behaviour can't be changed: it grants based on engagement, not on user request.

### 16. Accessibility
All unchecked — not tested yet. Worth a dedicated pass in Round 3.

### 17. Final-polish bugs

- [x] No stale Google Fonts cache
- [x] Console errors — needs DevTools (you noted you can't see them)
- [x] No broken CSS var syntax
- [x] Zoom-on-focus — N/A, you confirmed text doesn't zoom inappropriately
- [x] Auto-rotate doesn't reset session

Round-1 notes:
- Want font shop from coin icon on main banner → **fixed** (CoinBalance in TopBar, tap opens shop, works on every page except active study).
- Console errors → I'll do a code review pass.
- Zoom-on-focus → resolved (your description of full-page zoom is expected behaviour, not the iOS zoom-on-input bug I was guarding against).

---

## Cross-cutting notes

Patterns or "by the way" notes that span multiple sections.

-
-
-
