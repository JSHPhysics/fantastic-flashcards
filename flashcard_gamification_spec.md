# Flashcard App — Gamification Specification

## Overview

This document specifies the coin, rank, theme, font, and unlock systems for the
flashcard app. The system is adapted from the Revision Tracker (jshphysics.github.io)
which uses an identical architecture — the core logic is proven and should be ported
rather than reinvented.

**Important:** Claude Code building this app should read this document alongside the
existing codebase. Several features described below (card review flow, spaced
repetition algorithm, deck structure, session handling) will already be implemented.
This spec describes the gamification layer that sits on top of those features.
Where this document says "on card review" or "on session complete", interpret that
as hooking into whatever review/session completion events already exist in the code.

---

## 1. The Unit of Effort

In the Revision Tracker, coins are earned per checkbox tick.
In this app, coins are earned **per card practiced in a review session**.

### Earning rules
- 1 coin awarded per unique card reviewed per calendar day
- "Reviewed" means the student has seen the card and submitted a response — regardless
  of whether they answered correctly
- **Daily cap: 25 coins maximum per day** regardless of cards reviewed
  - Prevents pre-exam cramming sessions from unlocking everything overnight
  - Keeps the engagement loop intact across weeks, not just hours
- Same card reviewed multiple times in one day: only the first review awards a coin
  - Deduplication key: `cardId:YYYY-MM-DD`

### Bonus coins
Hook these into whatever review quality/result system already exists:
- **Correct answer on first attempt** (if the app tracks this): +1 bonus coin
  on top of the base coin, max 2 coins per card per day total
- **Deck completed** (all due cards in a deck reviewed in one session): +5 bonus
  coins awarded once per deck per day
- **Daily streak maintained** (if streak tracking exists): +3 bonus coins on login
  if the student reviewed at least 10 cards yesterday

If any of the above features don't exist yet in the codebase, implement just the
base 1-coin-per-card rule and leave the bonus system as a TODO.

---

## 2. Rank System

Ranks are calculated from **overall deck mastery percentage** — the proportion of
cards in the student's active decks that have reached a "confident" state in the
spaced repetition algorithm.

If the app doesn't use a spaced repetition confidence rating, substitute: proportion
of cards answered correctly on the most recent review attempt across all active decks.

### Rank thresholds (identical to Revision Tracker)

| Rank | Min % | Icon | Message |
|---|---|---|---|
| Unranked | 0% | ○ | — |
| Recruit | 5% | 🪵 | Your revision journey begins. Keep going! |
| Apprentice | 15% | 📖 | You're building momentum — great start! |
| Scholar | 25% | 🎓 | A quarter of the way there. You're doing this! |
| Practitioner | 40% | ⚗️ | Real progress now. Half the battle is showing up. |
| Expert | 55% | 🔬 | More than half done. You're well on your way. |
| Master | 70% | ⭐ | Outstanding dedication — you're in the top tier. |
| Grandmaster | 82% | 🌟 | Nearly there. Push through to the finish! |
| Elite | 92% | 💎 | So close to perfect. One final push! |
| Legend | 100% | 🏆 | You've achieved a perfect score. Truly legendary! 🎉 |

### Rank scope
- Rank is calculated **per subject** if cards are organised by subject
- If the app organises cards by deck only (no subject grouping), rank is calculated
  per deck
- An overall rank across all decks/subjects uses the same Double/Triple Legend logic:
  - Double Legend: 100% mastery on 2+ subjects/decks
  - Triple Legend: 100% mastery on 3+ subjects/decks

### Rank-up behaviour
On rank-up, trigger a popup with:
- Rank icon (emoji from table above)
- Rank label
- Message from the table above
- Confetti at the appropriate intensity:
  - Levels 2–3 (Recruit through Master): 40-piece confetti
  - Level 4 (Grandmaster, Elite): 80-piece confetti
  - Legend: 140-piece gold-only confetti + special message

Check for rank-up after every card review session ends, not after every individual
card. Recalculate the mastery percentage at session end and compare to the rank
at session start.

---

## 3. Theme Shop

### Pricing (4× the Revision Tracker prices — adjusted for higher coin earn rate)

| Theme | Type | Cost |
|---|---|---|
| Slate | Free | 0🪙 |
| Warm | Free | 0🪙 |
| Lavender | Free | 0🪙 |
| Midnight | Free | 0🪙 |
| Graphite | Free | 0🪙 |
| Forest | Free | 0🪙 |
| Ocean | Purchasable | 100🪙 |
| Sunset | Purchasable | 100🪙 |
| Cherry Blossom | Purchasable | 200🪙 |
| Volcanic | Purchasable | 200🪙 |
| Arctic | Purchasable | 300🪙 |
| Neon | Purchasable | 300🪙 |
| Rose Gold | Purchasable | 400🪙 |
| Amethyst | Purchasable | 400🪙 |
| Subject themes (CS, Chem, Bio, Classics, Physics) | Secret code only | 0🪙 |

At the 25 coin/day cap, approximate unlock times:
- Ocean/Sunset: ~4 days of consistent daily review
- Cherry Blossom/Volcanic: ~8 days
- Arctic/Neon: ~12 days
- Rose Gold/Amethyst: ~16 days

### Theme CSS variable system

Themes are applied by setting `data-theme` on `document.documentElement`.
All colours in the app must use CSS custom properties — never hardcoded hex values.

The full CSS variable set should match the Revision Tracker exactly so themes are
visually consistent across both apps (students may use both):

```css
:root {
  --bg: #f0f2f8;
  --surface: #ffffff;
  --surface2: #f7f8fc;
  --surface3: #eef0f7;
  --bd: rgba(0,0,0,0.08);
  --bd2: rgba(0,0,0,0.14);
  --tx: #1a1f36;
  --tx2: #4a5568;
  --tx3: #8a94a6;
  --r: 10px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --c1: #4361ee; --c1d: #2842cc;
  --c2: #f4a261; --c2d: #d4771a;
  --c3: #2ec4b6; --c3d: #1a9e96;
  --shadow: 0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06);
  --hdr-bg: rgba(255,255,255,0.94);
  --track: #eaecf5;
}
```

In the flashcard context, `--c1/c2/c3` can be reinterpreted as:
- `--c1`: Primary action colour (e.g. "Again" button or card front accent)
- `--c2`: Secondary colour (e.g. "Good" button or progress indicator)
- `--c3`: Tertiary colour (e.g. "Easy" button or streak indicator)

---

## 4. Font System

### Free fonts (system defaults, no unlock needed)
- System UI stack (the `:root` default above)

### Unlockable fonts (via secret code or coin purchase if implemented)
All fonts load from Google Fonts. Add `font-display: swap` and system fallbacks.

| Font | Code | Style |
|---|---|---|
| Inter | FN2K7T | Clean professional |
| Poppins | FN5X1R | Friendly geometric |
| Nunito | FN8Q4M | Rounded, approachable |
| Raleway | FN3W9J | Elegant, thin |
| DM Sans | FN6P2C | Modern, readable |
| Playfair Display | FN1N7Z | Elegant serif |
| Space Mono | FN4D0K | Monospace, technical |
| Merriweather | FN7H5B | Readable serif |
| Concert One | FN0Y3S | Display, bold |
| Schoolbell | FN2L8W | Handwritten, casual |
| Chewy | FN5C1X | Playful, bubbly |
| Indie Flower | FN8F4Q | Handwritten, friendly |
| Pacifico | FN1K9D | Retro, rounded |

Applied by setting `--font` on `:root`. Font preference persisted to user settings.

---

## 5. Secret Unlock Codes

Codes are entered in a text input in the settings/unlock panel.
Entry is case-insensitive. Codes are idempotent (redeeming twice is a no-op, not an error).
Show the history of redeemed codes in the panel.

### Code catalogue

```
Theme codes (individual):
TH7X2Q  — Ocean theme
TH4K9W  — Sunset theme
TH3M1P  — Cherry Blossom theme
TH8J5N  — Volcanic theme
TH2R6Y  — Arctic theme
TH5V0D  — Neon theme
TH9L3F  — Rose Gold theme
TH6B8E  — Amethyst theme

Font codes (individual):
FN2K7T  — Inter
FN5X1R  — Poppins
FN8Q4M  — Nunito
FN3W9J  — Raleway
FN6P2C  — DM Sans
FN1N7Z  — Playfair Display
FN4D0K  — Space Mono
FN7H5B  — Merriweather
FN0Y3S  — Concert One
FN2L8W  — Schoolbell
FN5C1X  — Chewy
FN8F4Q  — Indie Flower
FN1K9D  — Pacifico

Subject team codes (theme pair + font bundle):
TEAMCS        — CS Terminal Light + Dark themes, Share Tech Mono font
TEAMCHEM      — Chem Lab Light + Dark themes, Rajdhani font
TEAMBIO       — Bio Specimen Light + Dark themes, Comfortaa font
TEAMCLASSICS  — Classics Papyrus Light + Dark themes, Cinzel font
TEAMPHYSICS   — Physics Oscilloscope + Signal themes, Share Tech Mono font

Master codes (unlock everything):
MX9Z2QV   — All themes, fonts
LEHS2025  — All themes, fonts (alternative master code)

Staff room:
THESTAFFROOM  — Opens a code reference panel listing all available codes
               (for teacher/admin use — shows what codes exist without
                revealing what they unlock until redeemed)

Debug (development only — NODE_ENV check required):
COINMAX    — Sets coin balance to 9999
RESETALL   — Wipes all progress and coins for the current user only
DEBUGMODE  — Enables verbose logging
```

### Validation logic
```typescript
function redeemCode(code: string): RedeemResult {
  const normalised = code.trim().toUpperCase();

  // Already redeemed — return success silently, no DB write
  if (user.unlockedCodes.includes(normalised)) {
    return { success: true, alreadyRedeemed: true };
  }

  const def = UNLOCK_CODES[normalised];
  if (!def) return { success: false, error: 'Invalid code' };

  // Debug codes only in development
  if (def.category === 'debug' && process.env.NODE_ENV !== 'development') {
    return { success: false, error: 'Invalid code' };
  }

  // Apply unlock and persist
  applyUnlock(def);
  persistUnlockCode(normalised);
  return { success: true, description: def.desc };
}
```

---

## 6. Unlocks Shop UI

A modal/panel with three tabs: **Themes · Fonts · Layouts** (if layouts are applicable
to the flashcard app — omit if not relevant).

### Themes tab
Display themes in two columns: Light themes | Dark themes.
Each theme shows:
- Three colour swatches (the `dots` array from the theme definition)
- Theme name
- Status: "Free" / cost in coins / "Unlocked" / "Owned" (if purchased)
- Current theme highlighted with a border

### Fonts tab
Each font shown in its own typeface — the font name rendered using that font.
Same lock/cost/unlock logic as themes.

### Coin balance
Shown prominently at the top of the modal.
Format: `🪙 143 coins available`

### Purchase flow
1. Student clicks a locked item
2. If sufficient coins: confirm purchase dialog → deduct coins → unlock
3. If insufficient coins: show "You need X more coins" — do not allow purchase
4. Purchases are server-validated — client never modifies coin balance directly

---

## 7. Integration Notes for Claude Code

### What to check in the existing codebase before implementing

1. **How card reviews are recorded** — find the function/event that fires when a
   student submits a response to a card. The coin award hooks into this.

2. **How sessions are tracked** — find where a review session starts and ends.
   The rank-up check and deck completion bonus hook into session end.

3. **How user settings are persisted** — themes, fonts, and unlocked codes need
   to survive page reloads. Use whatever persistence mechanism already exists
   (localStorage, API call to user settings, etc.).

4. **How the spaced repetition state is stored** — the rank percentage calculation
   needs to query "how many cards are in a confident/mastered state". Find the
   field that represents this in the existing data model.

5. **Existing UI patterns** — match the modal/overlay style already in use rather
   than introducing new patterns. The unlock shop should feel native to the app.

### What to build from scratch

- Coin balance storage and deduplication (`coinsEarned` set keyed by `cardId:date`)
- Daily cap enforcement (server-side check against today's coin count)
- Rank calculation function (pure function: `rankForPct(pct: number): Rank`)
- Rank-up detection (compare rank at session start vs session end)
- Theme CSS variable system (if not already present)
- Unlock code validation and catalogue
- Shop modal UI

### What NOT to build in this session

- Pet system — this app does not have a pet
- Analytics event tracking — add as a separate pass once features work
- Any feature from the "future vision" that isn't listed in this document
