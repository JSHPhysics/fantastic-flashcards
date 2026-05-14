# FantasticFlashcards — Flashcard Survivors

**Author:** Joshua Stafford-Haworth
**Companion to:** `FantasticFlashcards-Playbook.md`, `FantasticFlashcards-BuildPlan.md`
**Repository:** https://github.com/JSHPhysics/fantastic-flashcards

---

## 1. Session Brief

### What we're adding

A *Vampire Survivors*-style alternate review mode called **Flashcard Survivors**. Player is a stationary turret at centre-screen. Geometric shapes spawn at the perimeter and drift inward; each shape carries the **front of a flashcard**. The player answers the card to fire a projectile that damages the target. Targets reaching the centre damage the player. Kills give XP; level-ups pause the game and offer a 3-choice upgrade modal (new weapons, weapon-specific upgrades, or generic damage-type upgrades). Max 5 weapons per run. **Insight** is earned per run and spent in a between-runs **Mastery Tree** for permanent unlocks.

The mode supports **two input modes** chosen per run: **Keyboard Mode** (type the back of the card — free recall) and **Tap Mode** (tap target, tap correct answer from 4 choices — recognition). Tap Mode exists primarily for iPad and accessibility; both modes use identical engine, weapons, difficulties, and Insight rewards.

### Why it belongs in this app

- Active recall remains the load-bearing mechanic — typing **is** aiming. The bullet-hell layer is the reward.
- Cards are pulled from the existing FSRS due queue by default. Enemy stats derive from card properties (retrievability, difficulty, lapse count), so the mode mechanically maps to retrieval-strength concepts rather than being purely cosmetic.
- Mastery Tree provides a meta-progression hook to bring students back across sessions without compromising the core spaced-repetition pipeline.

### Default design decisions

1. **No FSRS impact on cards reviewed in Flashcard Survivors.** Engagement mode, not canonical review. Toggleable later.
2. **Sibling of standard review**, not a replacement. Selected from the same deck-launch screen.
3. **Local high-scores and Mastery Tree state only.** No leaderboards, no accounts.
4. **Basic cards only.** Cloze, image-occlusion, and draw-type cards are skipped silently and replaced from the queue (see §2.3). The deck-selection screen for this mode shows a clear notice recommending decks made of basic cards (see §2.12).

### Scope discipline

- v1 ships with 12 weapons, ~25 in-run upgrade nodes, 12 Mastery Tree nodes, 3 difficulties, and 2 input modes (Keyboard / Tap).
- No sound until polish session.
- No animations beyond projectile motion, hit flashes, and shape spawn/death tweens in v1.

### Out of scope (do not build)

- Networked play, leaderboards, account sync.
- Card editing inside the game mode.
- Cloze / occlusion / draw card support — these fall through the skip path (§2.3).

### Suggested session split for Claude Code

| # | Focus | Deliverable |
|---|-------|-------------|
| S1 | Core loop scaffold | Canvas/PIXI mount, spawn system, Recall Cannon, HP/XP, game-over screen |
| S2 | Weapon system + level-up | Weapon registry, upgrade modal, 4 weapons total |
| S3 | Full weapon roster + tags | All 12 weapons, tag-synergy resolver, full in-run upgrade pool |
| S4 | Integration, difficulties, input modes, Mastery Tree, persistence | Deck-launch entry, Easy/Normal/Hard, Keyboard + Tap input modes, Mastery Tree UI, Insight economy, high-score store, balance pass |

---

## 2. Specification

### 2.1 Tech notes

- **Renderer:** PixiJS (lightweight, mature, fine on iPad). Fall back to plain Canvas if dependency budget is a concern — flag before adding.
- **Game loop:** Fixed timestep (60Hz logical, render to RAF). Pause-safe.
- **Input:** Two switchable input modes (see §2.6). Keyboard input for free-recall mode; large touch buttons for tap-mode (iPad-friendly). Mode chosen per run from the deck-select screen.
- **State:** Local React state for menu/UI, dedicated game engine module (plain TS class, no React) for the live game. React only re-renders HUD overlays via a thin pub/sub.
- **Persistence:** IndexedDB (same store as the rest of the app), under new tables — `survivorRuns`, `survivorStats`, `survivorMastery` (see §2.13).

### 2.2 File structure

```
src/
├── modes/
│   └── flashcardSurvivors/
│       ├── FlashcardSurvivorsSession.tsx   // React entry; mounts canvas, HUD, modals
│       ├── engine/
│       │   ├── GameEngine.ts               // Main loop, state machine
│       │   ├── Spawner.ts                  // Enemy spawn logic, difficulty curve
│       │   ├── Enemy.ts                    // Enemy entity + card binding
│       │   ├── Projectile.ts
│       │   ├── Player.ts                   // HP, XP, position (centre)
│       │   ├── InputMode.ts                // Keyboard | Tap mode strategy interface
│       │   ├── KeyboardInput.ts            // Live-typing resolver
│       │   ├── TapInput.ts                 // Target selection + 4-choice generation
│       │   ├── tagResolver.ts              // Weapon ↔ card tag synergy rules
│       │   └── difficulty.ts               // Easy/Normal/Hard parameter sets
│       ├── weapons/
│       │   ├── registry.ts                 // All weapon defs
│       │   ├── types.ts                    // Weapon, Tag, Upgrade interfaces
│       │   └── behaviours/                 // One file per weapon behaviour fn
│       ├── upgrades/
│       │   └── pool.ts                     // In-run upgrade defs + roll logic
│       ├── mastery/
│       │   ├── tree.ts                     // Mastery node defs + cost/prereq logic
│       │   └── effects.ts                  // How active masteries modify engine state at run start
│       ├── ui/
│       │   ├── HUD.tsx
│       │   ├── LevelUpModal.tsx
│       │   ├── GameOverScreen.tsx          // Shows Insight earned + breakdown
│       │   ├── MasteryTreeScreen.tsx       // Between-runs spend screen
│       │   ├── DeckSelectScreen.tsx        // Mode-specific deck selection with basic-cards notice
│       │   ├── TypingInput.tsx             // Keyboard-mode input
│       │   └── TapChoiceTray.tsx           // Tap-mode 4-choice button tray
│       └── persistence/
│           └── survivorStore.ts            // IndexedDB wrappers
```

### 2.3 Core loop

1. Player selects deck(s) on the Flashcard Survivors deck-select screen (see §2.12), picks difficulty, starts run.
2. Engine pulls due cards from FSRS queue into a working pool, **filtered to basic cards only**. Refills as cards are killed.
3. **If a non-basic card is encountered** (cloze, occlusion, draw type): skip silently, draw the next eligible card, continue. The skipped card is **not** marked as reviewed or affected in any way.
4. Spawner emits enemies on a curve (see §2.5). Each enemy is **bound to a card**; its front renders on the shape.
5. Player answers cards through the active input mode (see §2.6). In both modes:
   - A correct answer locks the targeted enemy, Recall Cannon fires immediately, streak +1.
   - A wrong answer or missed Enter resets the streak (unless **Persistent Recall** mastery is active). No additional HP penalty.
6. Passive weapons fire on their own intervals/conditions.
7. Enemy reaches centre → player HP −= enemy contact damage.
8. Player HP ≤ 0 → game over. Show stats, Insight earned, save run (§2.13).
9. XP → level → pause → modal with 3 rolled upgrade choices → resume.

### 2.4 Card → Enemy mapping

| Card property | Enemy property | Mapping |
|---|---|---|
| FSRS difficulty | HP | `Math.round(10 + difficulty * 8)` |
| Retrievability | Speed | Lower R = faster (forgotten cards rush you) |
| Lapse count | Contact damage | More lapses = bigger hit on impact |
| Deck/tag | Shape colour + tag set | Drives weapon synergies |
| Card length (back, chars) | Size | Longer answer = larger shape (more telegraphed, more rewarding) |
| Streak ≥ 5 correct | "Elite" variant | Visually distinct, +50% HP, +1 upgrade roll on kill |

If the due queue is exhausted mid-run, fall back to "any due-or-due-soon" basic cards from selected decks, then to random basic cards in selected decks. Never block the spawner.

### 2.5 Difficulty modes

Three difficulties shipped at v1. All values defined in `engine/difficulty.ts`.

| Parameter | Easy | Normal | Hard |
|---|---|---|---|
| Starting player HP | 120 | 100 | 80 |
| Initial spawn interval | 3.0s | 2.5s | 2.0s |
| Final spawn interval (after 5 min) | 0.9s | 0.6s | 0.45s |
| Max concurrent enemies | `4 + floor(min*1.5)` cap 18 | `5 + floor(min*2)` cap 25 | `6 + floor(min*2.5)` cap 32 |
| Wave event interval | 75s | 60s | 45s |
| Boss interval | 4 min | 3 min | 2.5 min |
| Enemy contact damage multiplier | ×0.7 | ×1.0 | ×1.3 |
| XP gain multiplier | ×1.0 | ×1.0 | ×1.15 |
| Insight earned multiplier | ×1.0 | ×1.5 | ×2.0 |

Difficulty selection persists per deck (last used).

### 2.6 Input modes

Two input modes, chosen per run from the deck-select screen. Both feed the same engine: the only difference is how a "correct answer" event is generated. Insight, XP, difficulty curves, weapons, and mastery effects are identical across modes.

Mode is **fixed at run start** in v1 — no mid-run switching.

**Implementation pattern:** `engine/InputMode.ts` defines a strategy interface with three methods: `attach(engine)`, `detach()`, and `onTick(dt)`. `KeyboardInput.ts` and `TapInput.ts` implement it. The engine doesn't know which is active.

#### 2.6.1 Keyboard Mode

For desktop, or iPad with an external keyboard.

- Single text input anchored to the HUD, always focused.
- Live-match the typed string against the **back** of every on-screen card-enemy.
- First exact match (case/whitespace normalised) → that enemy is locked, Recall Cannon fires, input clears, streak +1.
- Enter without match → streak resets (no HP penalty).
- **Speed bonus** for Recall Cannon damage = time from when the card first appeared on screen to the lock event. <2s = 2×, linear to 8s = 1×.

Higher skill ceiling: a fast typist can dispatch a cluster of enemies in rapid succession by typing through them.

#### 2.6.2 Tap Mode

For iPad, touch devices, and users with typing constraints.

- Bottom ~25% of the screen reserved for the **TapChoiceTray** — a 2×2 grid of large answer buttons (≥ 64pt tap targets per Apple HIG).
- The tray is empty until a target is selected.
- **Selecting a target:** tap any enemy shape. It receives a selection ring; its 4 choices populate the tray (correct answer + 3 distractors).
- **Answering:** tap a tray button.
  - Correct → enemy locked, Recall Cannon fires, tray clears, streak +1.
  - Wrong → streak resets, tray clears, target deselected. No HP penalty.
- **Switching targets:** tapping a different enemy mid-selection swaps the tray to the new target's choices.
- **Deselecting:** tap empty canvas → tray clears, no penalty.
- **Speed bonus** for Recall Cannon damage = time from target selection to correct-answer tap. <1s = 2×, linear to 4s = 1×. (Tighter window because selection is deliberate.)

Lower skill ceiling: rate-limited by the two-step interaction (select, then answer). One target addressed at a time.

**Distractor generation (`engine/TapInput.ts`):**

- Distractor pool: backs of all other basic cards in the selected deck(s).
- Pick 3 random distractors per card, **cached per card per run** so repeat encounters of the same card always show the same 4 choices. Aids learning; prevents lucky-guess gaming via reshuffling.
- Deduplicate against the correct answer (case-insensitive, whitespace-normalised).
- **Minimum eligibility:** the selected deck combination must contain ≥ 4 basic cards total. If not, the deck-select screen disables Tap Mode for that combination and shows a tooltip explaining why.

**Synergy weapons in Tap Mode:** all weapons that key off "correct answer" events (Recap Volley, Spaced Salvo, Streak Conductor, Elaboration Cloud, etc.) behave identically to Keyboard Mode. The engine sees the same event regardless of input.

### 2.7 Weapons

**Tag taxonomy:**

| Tag | Meaning |
|---|---|
| `kinetic` | Direct physical projectiles |
| `energy` | Beams, pulses, AoE radiations |
| `summon` | Autonomous orbs/drones |
| `support` | Passives, slows, buffs |
| `synergy` | Triggers on card properties or streak conditions |

A weapon may carry multiple tags. Generic upgrades target tags (e.g., "+10% kinetic damage"); they stack on multi-tag weapons.

**Roster (v1 — 12 weapons):**

| # | Name | Tags | Behaviour |
|---|---|---|---|
| 1 | **Recall Cannon** | kinetic, synergy | *Always equipped, starting weapon.* Fires on correct answer. Damage = base + speed bonus (faster answer = more damage, capped at 2×). |
| 2 | **Echo Orbital** | energy, summon | 2 orbs rotate around player; contact damage. Levels add orbs and radius. |
| 3 | **Mnemonic Pulse** | energy | Periodic shockwave from player. Damages all in radius. Cooldown shortens with levels. |
| 4 | **Recap Volley** | kinetic, synergy | Fires an extra projectile each time you correctly answer a card you've already seen *this run*. |
| 5 | **Spaced Salvo** | kinetic, synergy | On kill of a card with retrievability < 0.6, fires 3-projectile spread at nearest enemies. |
| 6 | **Confidence Spike** | kinetic | Charged piercing shot. Charges with streak; fires automatically at the highest-HP target when fully charged. |
| 7 | **Reasoning Beam** | energy | Continuous low-DPS beam locks onto lowest-HP enemy. Ramps damage the longer it stays on one target. |
| 8 | **Forgetting Sentry** | summon | Autonomous drone that prioritises enemies *closest to centre*. |
| 9 | **Schema Splitter** | kinetic | Recall Cannon projectiles (and only those) split into 2 on hit. Stacks: split-of-splits at higher levels. |
| 10 | **Working Memory Buffer** | support, summon | Defensive orb that absorbs N contact hits before destroying itself; respawns on a cooldown. |
| 11 | **Streak Conductor** | energy, synergy | Builds charge with streak. At streak 10, releases chain lightning to up to 5 enemies. Resets on miss. |
| 12 | **Elaboration Cloud** | energy, synergy | On kill, leaves a DoT cloud at the enemy's position. Larger cloud if the killed card was tagged the same as the previous kill. |

Each weapon has 5 levels. Level-up effects defined per weapon in `weapons/registry.ts` — mix of additive (damage, projectile count, radius) and unlock-style (e.g., Schema Splitter L4: splits also pierce).

### 2.8 In-run upgrade pool

On level-up, roll 3 distinct options from:

| Type | Weight | Examples |
|---|---|---|
| **New weapon** | High (until 5 weapons reached, then 0) | Adds a weapon at L1 from the unowned pool |
| **Weapon upgrade** | High | Levels a specific owned weapon by 1 |
| **Tag upgrade** | Medium | `+10% kinetic damage`, `+15% energy AoE`, `+1 summon cap`, `+5% support cooldown reduction` |
| **Player upgrade** | Medium | `+15 max HP`, `+10% XP gain`, `+0.5s level-up timer freeze`, `+5% projectile speed (all)` |
| **Exotic upgrade** | Low | `Streak no longer resets on miss (once per run)`, `Boss kills drop 2 upgrades`, `Elite cards spawn 50% more often` |

Starting weights: `[0.45, 0.30, 0.15, 0.07, 0.03]`. After 5 weapons owned, new-weapon weight redistributes proportionally to the remaining categories. Final balance to be tuned in S4.

### 2.9 Mastery Tree (across-run meta progression)

**Currency: Insight.** Earned at end of run:

```
insight = floor(cardsKilled / 5)
       + (durationMinutes >= 5 ? 5 : 0)
       + (durationMinutes >= 10 ? 10 : 0)
       + (bossesKilled * 3)
       + difficultyMultiplier   // see §2.5
```

Spent on permanent nodes in the Mastery Tree, available before any run from the Flashcard Survivors menu.

**Tree (v1 — 12 nodes):**

| Tier | Node | Cost | Effect |
|---|---|---|---|
| 1 | **Mnemonic Reserve** | 20 | +20 starting HP |
| 1 | **Quick Study** | 20 | +10% XP gain |
| 1 | **Practiced Hands** | 25 | +5% projectile speed at run start |
| 1 | **Persistent Recall** | 30 | First miss per run doesn't break streak |
| 2 | **Reroll Insight** | 60 | 1 reroll available per level-up modal |
| 2 | **Boss Wisdom** | 60 | Boss kills offer 4 upgrade choices instead of 3 |
| 2 | **Vigilance** | 70 | +15% damage to enemies in the inner zone (closer to centre) |
| 2 | **Diligent Practice** | 80 | Start each run with Recall Cannon at L2 |
| 3 | **Synergy Theorist** | 150 | Tag upgrades count as 2 stacks instead of 1 |
| 3 | **Boundless Arsenal** | 180 | Weapon cap increased from 5 to 6 |
| 3 | **Elite Spawning** | 150 | +25% elite spawn rate, +20% XP from elites (risk/reward) |
| 3 | **Forgotten Mastery** | 250 | Unlocks Insane difficulty (×3 Insight multiplier) |

Tier 2 requires any 2 Tier-1 nodes purchased. Tier 3 requires any 2 Tier-2 nodes purchased. Nodes are independent within a tier — no forced paths. Nodes are permanent and cannot be refunded in v1.

Mastery effects are applied at the start of each run by `mastery/effects.ts` before the engine begins ticking.

### 2.10 Level-up modal

- Pauses the engine completely (no enemies advance, no time accrues).
- Shows 3 cards horizontally. Each shows: name, tag chips, current → next-level effect (or "NEW" badge).
- Keyboard: 1/2/3 to pick, Enter to confirm, R to reroll (if **Reroll Insight** mastery is unlocked).
- Touch: tap.
- Closing the modal auto-focuses the typing input.

### 2.11 HUD

Minimal. Top-left: HP bar + XP bar with current level. Top-right: weapon icons (5 or 6 slots per mastery, greyed if empty) with small level pips. Centre-bottom: typing input, anchored, large font, faint background. Top-centre: streak counter and run timer.

### 2.12 Deck-select screen for Flashcard Survivors

Mode-specific deck-select screen with three visible elements:

1. **Notice banner at top** (dismissible per session, never persistently hidden):

   > **Recommended:** Flashcard Survivors works best with decks made of basic front/back cards. Cloze, image-occlusion, and draw cards are skipped automatically in this mode.

2. **Deck list** — same components as the standard review deck-select, but each deck row shows a small "% basic cards" badge. Decks below 50% basic cards show a soft warning chip ("Mostly non-basic — many cards will be skipped").

3. **Difficulty selector** below the deck list — three pill buttons: Easy / Normal / Hard, with Insane greyed out until the Forgotten Mastery node is purchased. Default to last-used per deck.

4. **Input mode selector** — two pill buttons: **Keyboard** / **Tap**. Defaults to last-used per deck. Tap is disabled (with explanatory tooltip) if the selected deck combination contains fewer than 4 basic cards.

### 2.13 Persistence (IndexedDB schema additions)

```ts
interface SurvivorRun {
  id: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  difficulty: 'easy' | 'normal' | 'hard' | 'insane';
  inputMode: 'keyboard' | 'tap';
  cardsKilled: number;
  bossesKilled: number;
  finalLevel: number;
  weapons: { id: string; level: number }[];
  decksPlayed: string[];
  bestStreak: number;
  insightEarned: number;
  cause: 'death' | 'quit';
}

interface SurvivorStats {
  bestDurationMs: Record<Difficulty, Record<InputMode, number>>;
  bestCardsKilled: Record<Difficulty, Record<InputMode, number>>;
  bestStreak: number;
  totalRuns: number;
  weaponUseCounts: Record<string, number>;
}

interface SurvivorMastery {
  insightBalance: number;
  insightLifetime: number;
  unlockedNodes: string[];   // node ids
}
```

### 2.14 Accessibility & UX guardrails

- All colour cues paired with shape cues — colour-blind safe.
- **Tap Mode (§2.6.2) is the primary accommodation for users who can't type quickly**, including iPad users without an external keyboard.
- In Keyboard Mode on iPad: when the on-screen keyboard is up, scale the canvas viewport so the player remains visible above the keyboard line. Recommend Tap Mode to users on touch devices via a subtle "Try Tap Mode?" link on first-launch.
- "Reduce motion" setting disables screen shake and projectile trails; gameplay parity preserved.
- Run can always be paused (Esc or HUD button). Pause does not count as game over.

### 2.15 Acceptance criteria for v1

- A run lasting 10 minutes on Normal is completable on iPad (Tap Mode) without dropping frames meaningfully (target 55+ fps).
- A run lasting 10 minutes on Normal is completable on desktop (Keyboard Mode) at 60 fps.
- A player who chooses upgrades randomly on Normal can survive at least 3 minutes against the default curve, in either input mode.
- A player choosing thematically coherent upgrades on Normal can survive 8+ minutes, in either input mode.
- All 12 weapons can be encountered in 5 independent runs.
- All non-basic card types are skipped without breaking the spawner or appearing as enemies.
- Tap Mode is disabled at deck-select if the deck combination contains fewer than 4 basic cards.
- Tap Mode distractors are consistent across repeat encounters of the same card within a single run.
- Insight earned and Mastery Tree state persist across browser restarts.
- No card data is ever modified by Flashcard Survivors.
