# QA checklist — live items

Round 1 (full iPad walkthrough) and Round 2 (retest after pass-1 fixes)
are archived in git history (`git log -- QA-CHECKLIST.md`). What follows
is what's actually open right now.

Live URL: https://jshphysics.github.io/fantastic-flashcards/. Hard-refresh
the first time you open it after a deploy — the service worker can hold
an older build.

**Useful shortcuts**

- Settings → Debug mode → "Generate sample decks". The demo set
  pre-funds 300 coins and marks ~40% of cards as mature so the rank
  card lands somewhere real (Practitioner band).
- Settings → Debug → **Gamification testbench**: directly award coins,
  set a balance, reset today's bucket, or force the rank-up popup at
  any tier. Avoids having to grind cards.
- Codes tab: `LEHS2025` unlocks all themes + fonts. `COINMAX` works
  whenever Debug mode is on.
- Coin pill in the top-bar opens the shop from any page.
- **Recovery URL**: `…/fantastic-flashcards/?reset-app=1` wipes service
  workers, caches, IndexedDB, and localStorage. Use if the app is stuck
  on a gray page or a broken cached build.

---

## Round 3 retest — pending pass-2 / pass-3 fixes

### Layout + modals
- [ ] **Modal sits with breathing room on all sides** on phones (Android + iPhone) and iPad (portrait + landscape). No edge-to-edge dock, no off-frame.
- [ ] **Wipe-all modal** renders correctly on Android phone (size + position).
- [ ] **CreateDeck dialog** stays on-screen in iPad landscape with the keyboard up; Save button reachable.
- [ ] **Bottom tab bar** stays fixed at the bottom while scrolling a long page or editing a form.

### Demo seed
- [ ] After **Generate sample decks**, the Rank card on Stats reads **Practitioner** (or near it), not Recruit. Mastery ~38%.
- [ ] Coin balance starts at **300**.
- [ ] Showcase deck cards still have no review history (intentionally fresh).

### Heatmap
- [ ] On iPad portrait, the year heatmap **fits the screen width without horizontal scroll**.
- [ ] Cells are big enough to tap accurately on iPad and iPhone.

### Theme + font pairing
- [ ] Redeem `TEAMCS` → tap "CS Terminal Dark" theme → **Share Tech Mono font applies automatically**.
- [ ] Same for `TEAMCHEM` → Rajdhani, `TEAMBIO` → Comfortaa, `TEAMCLASSICS` → Cinzel, `TEAMPHYSICS` → Share Tech Mono.
- [ ] Override the auto-applied font from the Fonts tab and it sticks across theme switches.

### Inputs
- [ ] AutoFill chip strip (password / card / location icons) **does not appear** on basic editor front, back, tags, MCQ options, Quizlet paste, deck name. Note: iOS QuickType predictive bar above the keyboard is OS-level and not suppressable from web code.

### Service worker recovery
- [ ] Visit `?reset-app=1` → page shows "Resetting…" → reloads clean.
- [ ] Force a JS error (e.g. tap something that throws): the boot-fallback paints with a "Reset the app and try again" button instead of staying gray.
- [ ] Wait 8s after killing the bundle (rename `assets/index-*.js` in DevTools network tab to force failure): watchdog fires the recovery panel.

### Gamification
- [ ] Same-card-twice-today dedup: review a card, then review it again. Balance increases by 1 the first time, stays flat the second.
- [ ] Rank-up dialog overlays the session summary (not the active card view) and doesn't re-fire on re-entry to the same session.

### Layout responsiveness (real device)
- [ ] iPad portrait (~768px): content fits 4xl max-width; modals centred with breathing room.
- [ ] iPad landscape (~1024px): main content at 4xl, modals comfortably centred.
- [ ] Android phone (any width 360-430px): full-width main content; modals float with 12px gutters all round.
- [ ] iPhone (any width 375-430px): same as Android phone.
- [ ] Desktop ≥1280px: main content stretches to 5xl; top-bar + bottom tabs match width.

### Accessibility (not yet tested)
- [ ] Tab through every focusable control in: home, deck detail, card editor, study session, shop, settings — focus ring visible at every stop.
- [ ] Esc closes every Dialog.
- [ ] VoiceOver reads icon-only buttons sensibly (FAB, dialog close, expand/collapse, dismiss banner).
- [ ] Each page has exactly one h1.
- [ ] Reduced-motion preference: confetti instant or skipped.
- [ ] Body-text contrast ≥ 4.5:1 against background in every theme (spot-check Neon + Volcanic with WebAIM).
- [ ] Touch targets ≥ 44pt (spot-check Stats tab pills, theme/font shop rows).

### Persistent storage
- [ ] Settings → Storage → "Persistent: Yes" after a few days of use (or after tapping "Ask now" + a deferred grant).

### Notes during retest
-
-
-

---

## Deferred (logged but not blocking v1.0.0)

These need real-device investigation that I can't do without an iPad
+ Apple Pencil. Each surfaced during pass-1 QA.

- **Apple Pencil per-point pressure variation along a stroke.** v1 samples
  pressure at pointerdown and uses it for the whole stroke. Per-point
  variation needs the Konva `sceneFunc` approach.
- **Eraser hit reticule.** A circle under the pencil showing what would
  be erased. Confidence-boost on dense diagrams.
- **Drawing-card background take-photo preview black on iPad.** Camera
  capture works (the photo lands correctly), but the live preview
  renders black for the drawing-card background flow specifically. The
  basic-card paste/upload path shows preview fine.
- **Microsoft Lens-style image crop / straighten.** Document mode crops
  the frame but doesn't auto-detect paper edges or deskew. Worth
  investigating opencv.js or a simpler edge-detector.
- **Occlusion canvas scroll on tall images.** Selecting a mask on a large
  image requires scrolling past the canvas first; the mask list at the
  bottom is hard to reach without losing canvas position.
- **Occlusion touch-and-hold ellipse mode.** Touch + hold to scale an
  ellipse out from the touch point — easier than drag-to-corner on a
  touch screen.
- **Drawing-canvas accidental select-all on pencil tap.** Tapping
  sometimes triggers a select-all instead of placing a stroke. Likely a
  Konva touch-action or stage draggable interaction.
- **"Clear all" tap registers as select with Apple Pencil.** The button
  inside the drawing toolbar sometimes intercepts as a selection.
