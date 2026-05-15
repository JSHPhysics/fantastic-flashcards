// The Flashcard Survivors engine.
//
// Pure-TS — no React. The React layer (`FlashcardSurvivorsSession.tsx`)
// mounts a <canvas> + HUD overlay, instantiates this engine, and listens
// to its event stream for HUD updates and modal triggers.
//
// Fixed timestep at 60Hz logical with render-on-RAF. Pause-safe: while
// the engine is paused (level-up modal, manual pause, game over), the
// loop continues running but `tick()` becomes a no-op except for
// rendering. That keeps timers stable when the modal closes.

import { newId } from "../../../db/ids";
import type { Card } from "../../../db";
import { buildSurvivorPool, cardBack, cardFront, normaliseAnswer, statsForCard } from "./cardPool";
import {
  DIFFICULTIES,
  maxConcurrentAt,
  spawnIntervalAt,
  timeRampAt,
} from "./difficulty";
import type {
  DotCloud,
  Enemy,
  EnemyView,
  EngineEvent,
  EngineEventListener,
  OwnedWeapon,
  PlayerStats,
  Projectile,
  RunConfig,
  RunSummary,
  TagBonus,
  Vec2,
} from "./types";
import type { InputMode } from "./InputMode";
import { WEAPONS_BY_ID, instantiate, getWeaponDef } from "../weapons/registry";
import {
  effectiveAreaMult,
  effectiveCooldownMult,
  effectiveDamageMult,
} from "./tagResolver";
import {
  rollUpgradeChoices,
  type UpgradeChoice,
} from "../upgrades/pool";
import { applyMasteryEffects } from "../mastery/effects";

const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;
const XP_BASE = 50;
const XP_GROWTH = 1.4;
// Inner-zone radius (where the Vigilance mastery bonus applies) used to
// be a fixed 110px, which meant on a phone the inner zone was the *whole
// visible field*. Now derived per-engine from this.fieldRadius via
// innerZoneRadius() so the inner zone is always ~25% of the play area.

export class GameEngine {
  // ---- Canvas + loop state ----
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private centreX = 0;
  private centreY = 0;
  // Computed by handleResize() — see comments there. trayReserve is the
  // bottom-of-canvas dead zone owned by the answer tray / typing input;
  // fieldRadius is the world-coord radius of the play area (used for
  // spawn distance + speed zone radii so the action scales with the
  // viewport rather than spawning at an absolute pixel distance that's
  // already off-screen on phones).
  private trayReserve = 0;
  private fieldRadius = 350;
  private rafId: number | null = null;
  private lastFrameTs = 0;
  private accumulator = 0;
  private now = 0; // engine time, ms, starts at 0
  private paused = false;
  private gameOver = false;

  // ---- Game state ----
  private cfg: RunConfig;
  private difficulty = DIFFICULTIES.normal;
  private cardPool: Card[] = [];
  private cardCursor = 0;
  private deckColours = new Map<string, string>();
  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private clouds: DotCloud[] = [];
  private player: PlayerStats;
  private weapons: OwnedWeapon[] = [];
  private weaponCap = 5;
  private tagBonus: TagBonus = {};
  private bufferCharges = 0;
  private bossesKilled = 0;
  private cardsKilled = 0;
  private nextSpawnAt = 1000;
  private rerollsRemainingThisLevelUp = 0;
  private innerZoneDamageMult = 1;
  private spawnedSelectedSet = new Set<string>(); // card ids seen in run
  // Selected-target visual ring (Tap Mode).
  private selectedEnemyId: string | null = null;
  // Throttled HUD broadcast — we don't want to re-render the React HUD
  // at 60Hz, but we also can't only emit on correct-answer / level-up
  // because contact damage + DoT / beam damage happen inside the tick
  // loop. 100ms feels live without spamming React.
  private nextStatsBroadcastAt = 0;
  // Cached theme colours read from CSS variables once at start(). The
  // canvas backdrop + the player turret + enemy outlines + projectile
  // bodies all use these so the game adopts whichever theme is active.
  // A theme change during a run only takes effect on the next run —
  // acceptable trade-off since theme changes mid-game are vanishingly
  // rare.
  private colours = {
    backdrop: "#0b1320",
    ink: "rgb(255 255 255)",
    inkMuted: "rgba(255,255,255,0.6)",
    innerZoneRing: "rgba(255,255,255,0.06)",
  };
  // Transient on-screen effects (hit flashes, kill bursts). Each lives
  // ~300-500ms then fades out. Pruned every tick. Strictly visual — no
  // gameplay consequence — so we can render them confidently without
  // worrying about determinism.
  private hitPulses: { pos: Vec2; bornAt: number; kind: "hit" | "kill" }[] = [];
  // Floating "+N XP" text spawned on every kill. Drifts up + fades out
  // over ~900ms. Lets the student SEE that auto-aim / DoT kills are
  // granting XP — without this feedback, the XP bar just slowly grows
  // and contact-damage kills (which legitimately grant no XP) get
  // confused with paths that do.
  private floaters: {
    text: string;
    pos: Vec2;
    bornAt: number;
    color: string;
  }[] = [];
  // Streak Conductor "chain lightning" visualisation. Each entry is an
  // ordered polyline (player → enemy1 → enemy2 → …) that animates on
  // as a sequential reveal then fades. Without this, hits all landed
  // simultaneously and the chain read as "everything explodes" rather
  // than "lightning links them."
  private chainBolts: {
    points: Vec2[];
    bornAt: number;
    revealMs: number;
    fadeMs: number;
  }[] = [];
  // Continuous beam visuals (Reasoning Beam, future beam weapons).
  // Keyed by weapon id so each beam-style weapon owns one slot — the
  // weapon refreshes its slot every tick with `setBeam`, and entries
  // not refreshed within ~120ms are pruned (so the beam fades out
  // when the weapon stops firing or its target dies).
  private beams = new Map<
    string,
    { from: Vec2; to: Vec2; intensity: number; lastSeen: number }
  >();

  // Active input strategy.
  private input: InputMode | null = null;

  // Event subscription.
  private listeners: EngineEventListener[] = [];

  constructor(canvas: HTMLCanvasElement, cfg: RunConfig) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.cfg = cfg;
    this.difficulty = DIFFICULTIES[cfg.difficulty];

    const mastery = applyMasteryEffects(cfg.masteryNodes);
    this.weaponCap = mastery.weaponCap;
    // bossUpgradeChoiceCount currently unused — bosses aren't separated
    // from elites in v1, but the field is read at run start so it's
    // available when boss-only logic lands.
    void mastery.bossUpgradeChoiceCount;
    this.innerZoneDamageMult = mastery.innerZoneDamageMult;

    this.player = {
      hp: this.difficulty.startingHp + mastery.startingHpBonus,
      maxHp: this.difficulty.startingHp + mastery.startingHpBonus,
      xp: 0,
      level: 1,
      xpToNextLevel: XP_BASE,
      projectileSpeedMult: mastery.projectileSpeedMult,
      xpGainMult: this.difficulty.xpGainMult * mastery.xpGainMult,
      pickupRange: 80,
      persistentRecallUsed: !mastery.persistentRecallAvailable, // false = available
      bossKillsDropTwoUpgrades: false,
      eliteSpawnRateBoost: mastery.eliteSpawnRateBoost,
      streak: 0,
      bestStreak: 0,
    };
    // Recall Cannon at level set by Diligent Practice mastery; default 1.
    this.weapons.push(instantiate("recall-cannon", mastery.startingRecallCannonLevel));

    this.handleResize();
  }

  // ---- Public API ----

  setInputMode(mode: InputMode): void {
    if (this.input) this.input.detach();
    this.input = mode;
    mode.attach({ engine: this, onMiss: () => this.onMiss() });
  }

  addEventListener(listener: EngineEventListener): void {
    this.listeners.push(listener);
  }
  removeEventListener(listener: EngineEventListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  async start(): Promise<void> {
    // Load card pool + deck colours.
    this.cardPool = await buildSurvivorPool(this.cfg.decks);
    // Cache deck colours so we don't query Dexie per-spawn.
    const { db } = await import("../../../db/schema");
    const decks = await db.decks.where("id").anyOf(this.cfg.decks).toArray();
    for (const d of decks) this.deckColours.set(d.id, d.colour);
    // Pick up the active theme's palette via CSS variables. These flow
    // into the canvas backdrop + player + enemy outlines.
    this.colours = readThemeColours();
    this.lastFrameTs = performance.now();
    this.broadcastStats();
    this.loop();
  }

  stop(): void {
    this.paused = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.input) this.input.detach();
  }

  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
    this.lastFrameTs = performance.now();
    // Reset focus into the run on resume from the pause screen — the
    // Resume button took DOM focus when tapped, same dance as the
    // level-up modal flow.
    this.emit({ type: "resume" });
  }
  isPaused(): boolean {
    return this.paused;
  }
  // Read-only accessors used by the manual pause screen so it can show
  // the run's accumulated tag bonuses and the player's mastery nodes
  // without us having to thread the engine instance through React state.
  getTagBonus(): TagBonus {
    return this.tagBonus;
  }
  getMasteryNodes(): string[] {
    return this.cfg.masteryNodes.slice();
  }
  getRunConfig(): { difficulty: RunConfig["difficulty"]; inputMode: RunConfig["inputMode"] } {
    return { difficulty: this.cfg.difficulty, inputMode: this.cfg.inputMode };
  }
  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    // The bottom of the canvas is covered by the input chrome (Tap-mode
    // 2x2 answer tray, or Keyboard-mode typing input). Treat it as a
    // dead zone: shift the player's screen position up by half the tray
    // height so enemies entering from the bottom still have visible
    // approach space, and the player isn't drowning under unusable UI.
    // Tray heights are estimated from the actual components — adjust if
    // either component grows.
    this.trayReserve = this.cfg.inputMode === "tap" ? 200 : 92;
    const usableHeight = Math.max(160, this.height - this.trayReserve);
    this.centreX = this.width / 2;
    this.centreY = usableHeight / 2;
    // Play field radius — the world's outer rim sits just inside the
    // visible canvas (minus an edge margin so enemies don't draw half
    // off-screen). On a phone (~360px wide, 580px usable tall) the
    // field is ~160; on iPad portrait (~768x844) ~360; on desktop
    // 16:9 ~480. Spawn + speed zones derive from this so the action
    // appears at a consistent ratio of viewport, not at an absolute
    // pixel distance that's already off-screen on phones.
    const edgeMargin = 24;
    this.fieldRadius = Math.max(
      120,
      Math.min(this.width / 2 - edgeMargin, usableHeight / 2 - edgeMargin),
    );
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Called by player triggering a manual quit (e.g. Esc menu).
  quit(): void {
    if (this.gameOver) return;
    this.finishGame("quit");
  }

  tickTime(): number {
    return this.now;
  }

  visibleEnemies(): Enemy[] {
    return this.enemies;
  }

  // Try to interpret raw typed text as an answer against any on-screen
  // enemy. Used by the keyboard input strategy AND by the typing input
  // that's always mounted alongside the tap tray, so tap-mode players
  // with a keyboard can also just type instead of tap-selecting. Returns
  // true when a match was found and fired.
  tryAnswerByText(text: string): boolean {
    if (this.gameOver) return false;
    const target = normaliseAnswer(text);
    if (target.length === 0) return false;
    const enemy = this.enemies.find(
      (e) => normaliseAnswer(cardBack(e.card)) === target,
    );
    if (!enemy) return false;
    this.recordCorrectAnswer(enemy.id);
    return true;
  }

  // Explicit "I gave up on this attempt" — resets streak the same way
  // KeyboardInput's submitWithNoMatch does, used when the user hits
  // Enter with text that doesn't match anything.
  recordMiss(): void {
    this.onMiss();
  }
  findEnemy(id: string): Enemy | null {
    return this.enemies.find((e) => e.id === id) ?? null;
  }
  broadcastTapChoices(enemyId: string, choices: string[]): void {
    this.selectedEnemyId = enemyId;
    this.emit({ type: "tapChoices", targetId: enemyId, choices });
  }
  broadcastTapCleared(): void {
    this.selectedEnemyId = null;
    this.emit({ type: "tapCleared" });
  }

  // High-HP enemies got dull: the student would just retype the same
  // answer twice. After a non-fatal *discrete* hit (projectile / direct-
  // damage weapon / streak chain), swap the enemy's card to a different
  // one from the pool. Visual stats (size, colour, shape) stay the
  // same — it's the same enemy, just harder, asking a new question.
  // DoT clouds intentionally don't trigger a swap (per user spec) so a
  // single Elaboration Cloud doesn't shuffle every enemy it touches.
  //
  // Side effects:
  //  - Tap mode: if the swapped enemy was the selected target, clear
  //    the tray; the choices were built around the old card and are
  //    now stale. Player re-taps to get fresh choices for the new card.
  //  - Enemy view is re-broadcast so the front label updates this tick.
  private swapEnemyCard(enemy: Enemy): void {
    if (this.cardPool.length < 2) return; // nothing meaningful to swap to
    // Pick a different card. Up to 8 attempts then accept whatever.
    let next = enemy.card;
    for (let i = 0; i < 8; i += 1) {
      const candidate =
        this.cardPool[Math.floor(Math.random() * this.cardPool.length)];
      if (candidate.id !== enemy.card.id) {
        next = candidate;
        break;
      }
    }
    if (next.id === enemy.card.id) return;
    enemy.card = next;
    if (this.selectedEnemyId === enemy.id) this.broadcastTapCleared();
    // Force a fresh enemy-view broadcast so the React layer's label
    // catches the new front before the next tick's natural broadcast.
    this.broadcastEnemyView();
  }

  // For Tap mode: find an enemy under a canvas-space point.
  // Two strategies stacked so overlapping enemies pick "the right one":
  //   1. Among every enemy whose bounding circle contains the tap,
  //      prefer the one whose CENTRE is closest to the tap point.
  //      Tapping near a specific enemy's middle reliably picks that
  //      enemy even if another's bounding circle technically overlaps.
  //   2. Tie-break by draw order — the later-drawn enemy (visually on
  //      top per Canvas's painter's algorithm) wins.
  // The previous reverse-iteration-only approach occasionally picked
  // the wrong enemy when two of different sizes overlapped: the larger
  // enemy's bounding circle covered space far from its centre, and a
  // tap landing in that fringe got bound to it even when a smaller
  // enemy was visually right under the finger.
  pickEnemyAt(canvasX: number, canvasY: number): Enemy | null {
    const x = canvasX - this.centreX;
    const y = canvasY - this.centreY;
    let best: Enemy | null = null;
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      const dx = x - e.pos.x;
      const dy = y - e.pos.y;
      const dist = Math.hypot(dx, dy);
      if (dist > e.size * 0.55) continue; // outside hit radius
      // Strictly closer wins; equal distances fall to the topmost
      // (later-drawn = higher index).
      if (dist < bestDist || (dist === bestDist && i > bestIdx)) {
        best = e;
        bestDist = dist;
        bestIdx = i;
      }
    }
    return best;
  }

  // Called by the input strategy when the player correctly answers.
  // speedBonusBaseMs (Tap Mode) overrides the keyboard mode default of
  // "time since spawn".
  recordCorrectAnswer(
    enemyId: string,
    opts: { speedBonusBaseMs?: number } = {},
  ): void {
    if (this.gameOver) return;
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    // Mark seen so Recap Volley fires on repeats.
    this.spawnedSelectedSet.add(enemy.card.id);
    enemy.seenThisRun = true;
    // Speed bonus: keyboard uses 2x at <2s, decaying to 1x by 8s; tap
    // uses 2x at <1s, decaying to 1x by 4s. We get the elapsed time
    // from spawn (keyboard) or from selection (tap, via opts).
    const baseMs = opts.speedBonusBaseMs ?? this.now - enemy.spawnedAt;
    const kbBonus =
      baseMs <= 2000 ? 2 : Math.max(1, 2 - (baseMs - 2000) / 6000);
    const tapBonus =
      baseMs <= 1000 ? 2 : Math.max(1, 2 - (baseMs - 1000) / 3000);
    const speedBonus = opts.speedBonusBaseMs !== undefined ? tapBonus : kbBonus;

    // Streak bookkeeping.
    this.player.streak += 1;
    if (this.player.streak > this.player.bestStreak) {
      this.player.bestStreak = this.player.streak;
    }

    // Schema Splitter: mark the next Recall Cannon projectile.
    const splitter = this.weapons.find((w) => w.id === "schema-splitter");
    const recall = this.weapons.find((w) => w.id === "recall-cannon");
    if (recall) {
      const def = getWeaponDef("recall-cannon");
      if (def?.onCorrectAnswer) {
        const handle = this.weaponHandle(def);
        def.onCorrectAnswer(handle, recall, enemy, speedBonus);
        // Tag the most recently spawned Recall projectile with split count.
        if (splitter) {
          const splits = [1, 1, 2, 2, 3][splitter.level - 1];
          const last = this.projectiles[this.projectiles.length - 1];
          if (last && last.sourceWeapon === "recall-cannon") {
            last.splitOnHit = splits;
            // L4: splits also pierce one extra enemy.
            if (splitter.level >= 4 && last.pierce !== undefined) {
              last.pierce = Math.max(last.pierce, 1);
            }
          }
        }
      }
    }

    // Other synergy weapons' onCorrectAnswer.
    for (const ow of this.weapons) {
      if (ow.id === "recall-cannon") continue;
      const def = getWeaponDef(ow.id);
      if (def?.onCorrectAnswer) {
        def.onCorrectAnswer(this.weaponHandle(def), ow, enemy, speedBonus);
      }
    }

    this.broadcastStats();
  }

  // ---- Internal loop ----

  private loop = (): void => {
    if (this.gameOver) return;
    this.rafId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const frameMs = Math.min(50, now - this.lastFrameTs);
    this.lastFrameTs = now;
    if (!this.paused) {
      this.accumulator += frameMs;
      while (this.accumulator >= TICK_MS) {
        this.tick(TICK_MS);
        this.accumulator -= TICK_MS;
      }
    }
    this.render();
  };

  private tick(dtMs: number): void {
    this.now += dtMs;
    if (this.input) this.input.onTick(dtMs);
    this.maybeSpawnEnemy();
    this.updateEnemies(dtMs);
    this.tickWeapons(dtMs);
    this.updateProjectiles(dtMs);
    this.updateClouds(dtMs);
    this.resolveProjectileHits();
    this.resolveContactHits();
    this.pruneDead();
    this.prunePulses();
    this.broadcastEnemyView();
    // Live HUD updates — tick-loop damage (contact, DoT clouds, beam
    // ramp) was previously invisible to the React HUD because we only
    // broadcast stats on correct-answer / upgrade / miss. Throttle to
    // ~10Hz so React doesn't re-render 60×/sec.
    if (this.now >= this.nextStatsBroadcastAt) {
      this.broadcastStats();
      this.nextStatsBroadcastAt = this.now + 100;
    }
  }

  private render(): void {
    const ctx = this.ctx;
    // Fill backdrop with the theme's body colour (--color-cream) instead
    // of clearing to transparent. That way the game viewport matches the
    // active theme — Midnight gives a near-black field, Cherry Blossom
    // gives a soft pink, etc.
    ctx.fillStyle = this.colours.backdrop;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.save();
    ctx.translate(this.centreX, this.centreY);
    // Inner-zone ring (subtle, theme-tinted).
    ctx.strokeStyle = this.colours.innerZoneRing;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, this.innerZoneRadius(), 0, Math.PI * 2);
    ctx.stroke();
    // Clouds (DoT) — saturated greenish-yellow with a dashed outline so
    // the boundary is visible even on pastel themes. Bumped fill alpha
    // from 0.18 → 0.30 because the original was washed out against
    // cream / lavender backdrops.
    if (this.clouds.length > 0) {
      ctx.save();
      for (const c of this.clouds) {
        ctx.fillStyle = "rgba(150, 215, 90, 0.30)";
        ctx.beginPath();
        ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "rgba(100, 170, 60, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    // Echo Orbital — orbs use theme ink with a saturated blue halo so
    // the player can track them whether on Midnight or Cherry Blossom.
    const echo = this.weapons.find((w) => w.id === "echo-orbital");
    if (echo) {
      const lvl = echo.level - 1;
      const orbs = [2, 2, 3, 3, 4][lvl];
      const orbRadius = [100, 120, 120, 140, 140][lvl];
      const theta = (echo.state.theta ?? 0) as number;
      for (let i = 0; i < orbs; i += 1) {
        const a = theta + (i / orbs) * Math.PI * 2;
        const x = Math.cos(a) * orbRadius;
        const y = Math.sin(a) * orbRadius;
        // Halo (additive-ish via low alpha).
        ctx.fillStyle = "rgba(90, 170, 255, 0.55)";
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
        // Body — theme ink so it's always visible.
        ctx.fillStyle = this.colours.ink;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Enemies.
    for (const e of this.enemies) {
      this.drawEnemy(e);
    }
    // Projectiles — bigger + ink body + kind-tinted halo + 2 trailing
    // ghosts based on velocity for motion feedback. The body uses the
    // theme ink so it pops against any backdrop; the halo carries the
    // weapon type (kinetic gold / energy green / summon purple).
    for (const p of this.projectiles) {
      const r = p.radius * 1.5;
      const dt = 0.018; // ~one frame back
      // Motion smear — two fading ghosts behind.
      ctx.fillStyle = projectileTint(p.kind, 0.35);
      ctx.beginPath();
      ctx.arc(p.pos.x - p.vel.x * dt, p.pos.y - p.vel.y * dt, r * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = projectileTint(p.kind, 0.18);
      ctx.beginPath();
      ctx.arc(p.pos.x - p.vel.x * dt * 2, p.pos.y - p.vel.y * dt * 2, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Halo around the body.
      ctx.fillStyle = projectileTint(p.kind, 0.55);
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      // Body — theme ink.
      ctx.fillStyle = this.colours.ink;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hit + kill pulses — expanding rings that fade out so the player
    // gets clear visual feedback every time a weapon connects.
    for (const pulse of this.hitPulses) {
      const age = this.now - pulse.bornAt;
      const duration = pulse.kind === "kill" ? 500 : 300;
      if (age > duration) continue;
      const t = age / duration; // 0..1
      const radius = pulse.kind === "kill"
        ? 8 + t * 38
        : 4 + t * 22;
      const alpha = 1 - t;
      ctx.lineWidth = pulse.kind === "kill" ? 3 : 2;
      ctx.strokeStyle = pulse.kind === "kill"
        ? `rgba(255, 200, 90, ${alpha.toFixed(3)})`
        : withAlpha(this.colours.ink, alpha);
      ctx.beginPath();
      ctx.arc(pulse.pos.x, pulse.pos.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Kill pulses get a second, slightly delayed inner ring for a
      // double-flash that reads as "down" rather than "hit".
      if (pulse.kind === "kill" && t > 0.25) {
        const innerT = (t - 0.25) / 0.75;
        ctx.strokeStyle = `rgba(255, 230, 150, ${(1 - innerT).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pulse.pos.x, pulse.pos.y, 4 + innerT * 22, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Continuous laser beams (Reasoning Beam). Each entry refreshes
    // its `lastSeen` every tick while firing; render reads the slot
    // directly. The visual is a laser line + impact sparks:
    //   - Wide outer glow (theme-tinted)
    //   - Thin bright core
    //   - 5–7 short radial sparks at the impact point that animate
    //     based on engine time so the impact looks like it's
    //     burning rather than statically drawn.
    if (this.beams.size > 0) {
      ctx.save();
      ctx.lineCap = "round";
      for (const b of this.beams.values()) {
        // Fade in/out gracefully when the beam was just refreshed
        // (or is about to expire). 0..120ms since lastSeen → 1..0.
        const sinceRefresh = this.now - b.lastSeen;
        const fade = Math.max(0, Math.min(1, 1 - sinceRefresh / 120));
        const intensity = Math.max(0, Math.min(1, b.intensity));
        // Outer halo — warm orange so the beam reads as energy and
        // contrasts with the cool projectile palette.
        const haloAlpha = 0.35 * fade * (0.6 + 0.4 * intensity);
        ctx.strokeStyle = `rgba(255, 140, 60, ${haloAlpha.toFixed(3)})`;
        ctx.lineWidth = 6 + 4 * intensity;
        ctx.beginPath();
        ctx.moveTo(b.from.x, b.from.y);
        ctx.lineTo(b.to.x, b.to.y);
        ctx.stroke();
        // Bright core — almost white so the beam visibly threads
        // through the halo.
        const coreAlpha = 0.95 * fade;
        ctx.strokeStyle = `rgba(255, 235, 200, ${coreAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.6 + 1.6 * intensity;
        ctx.beginPath();
        ctx.moveTo(b.from.x, b.from.y);
        ctx.lineTo(b.to.x, b.to.y);
        ctx.stroke();
        // Burning sparks at the impact point. Time-driven angles +
        // lengths so they appear to twinkle. The count + spread grow
        // with intensity so a fully-locked beam looks meatier.
        const sparkCount = 4 + Math.round(intensity * 4);
        const seed = b.to.x * 0.13 + b.to.y * 0.17;
        for (let i = 0; i < sparkCount; i += 1) {
          // Pseudo-random but smooth — drives angle/length variation
          // without needing per-frame state.
          const t = this.now * 0.012 + i * 1.7 + seed;
          const angle = Math.sin(t) * Math.PI * 1.3 + Math.cos(t * 1.7) * 0.9;
          const len = 4 + Math.abs(Math.sin(t * 2.3)) * (6 + intensity * 6);
          const sparkAlpha = (0.55 + 0.35 * Math.abs(Math.sin(t * 3.1))) * fade;
          ctx.strokeStyle = `rgba(255, 200, 110, ${sparkAlpha.toFixed(3)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(b.to.x, b.to.y);
          ctx.lineTo(
            b.to.x + Math.cos(angle) * len,
            b.to.y + Math.sin(angle) * len,
          );
          ctx.stroke();
        }
        // Small bright pip right at the impact so the spark cluster
        // anchors to the target.
        ctx.fillStyle = `rgba(255, 240, 200, ${(0.9 * fade).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(b.to.x, b.to.y, 2.5 + intensity * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Chain bolts (Streak Conductor) — sequential reveal first, then
    // fade. Drawn before the player so a bolt that starts at centre
    // doesn't overlap the turret's body. Lightning effect = two
    // strokes: a thick translucent "glow" underneath, then a thin
    // bright core on top.
    for (const bolt of this.chainBolts) {
      const age = this.now - bolt.bornAt;
      const total = bolt.revealMs + bolt.fadeMs;
      if (age > total) continue;
      // How many full segments are revealed, plus a partial fraction
      // for the segment currently being drawn.
      const segments = bolt.points.length - 1;
      const revealT = Math.min(1, age / bolt.revealMs);
      const exactSegs = revealT * segments;
      const fullSegs = Math.floor(exactSegs);
      const partial = exactSegs - fullSegs;
      // After the reveal, the whole polyline is visible and fades out.
      const fadeT = age <= bolt.revealMs
        ? 1
        : Math.max(0, 1 - (age - bolt.revealMs) / bolt.fadeMs);
      // Build the path: full segments + the partial leading edge.
      const drawPath = () => {
        ctx.beginPath();
        ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
        for (let i = 1; i <= fullSegs; i += 1) {
          ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
        }
        if (fullSegs < segments && partial > 0) {
          const a = bolt.points[fullSegs];
          const b = bolt.points[fullSegs + 1];
          ctx.lineTo(a.x + (b.x - a.x) * partial, a.y + (b.y - a.y) * partial);
        }
      };
      // Outer glow.
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(180, 220, 255, ${(0.35 * fadeT).toFixed(3)})`;
      ctx.lineWidth = 9;
      drawPath();
      ctx.stroke();
      // Bright core.
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.95 * fadeT).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      drawPath();
      ctx.stroke();
    }
    // Player (turret) at centre — uses theme ink so it pops against any
    // background. The outer ring is a faded variant of the same.
    ctx.fillStyle = this.colours.ink;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.colours.inkMuted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    // Floating "+N XP" labels. Painted last so they sit above
    // everything else (enemies, pulses, chains). Drifts up by ~24px
    // over its lifetime; fades over the final two-thirds. A faint
    // stroke gives readability against bright theme backdrops.
    if (this.floaters.length > 0) {
      ctx.save();
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 3;
      for (const f of this.floaters) {
        const age = this.now - f.bornAt;
        const lifetime = 900;
        if (age > lifetime) continue;
        const t = age / lifetime; // 0..1
        const dy = -t * 28; // drift up
        // Fade-in-fast, hold, fade-out: alpha = 1 until t=0.35, then
        // linear to 0 at t=1.
        const alpha = t < 0.35 ? 1 : Math.max(0, 1 - (t - 0.35) / 0.65);
        const x = f.pos.x;
        const y = f.pos.y + dy;
        ctx.strokeStyle = `rgba(0, 0, 0, ${(0.6 * alpha).toFixed(3)})`;
        ctx.strokeText(f.text, x, y);
        ctx.fillStyle = withAlpha(f.color, alpha);
        ctx.fillText(f.text, x, y);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawEnemy(e: Enemy): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);
    ctx.fillStyle = e.colour;
    // Outline uses the theme's ink colour for non-elites; elites still
    // get a gold ring so they're immediately distinguishable.
    ctx.strokeStyle = e.elite ? "#FFD580" : this.colours.inkMuted;
    ctx.lineWidth = e.elite ? 3 : 1.5;
    const r = e.size * 0.5;
    drawShape(ctx, e.shape, r);
    ctx.fill();
    ctx.stroke();
    // Selected indicator (Tap Mode) — high-contrast theme ink.
    if (this.selectedEnemyId === e.id) {
      ctx.strokeStyle = this.colours.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // HP bar.
    if (e.hp < e.maxHp) {
      const w = e.size * 0.9;
      const x = -w / 2;
      const y = -r - 10;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = "rgba(120,220,150,0.95)";
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), 4);
    }
    ctx.restore();
  }

  // ---- Spawning ----

  private maybeSpawnEnemy(): void {
    if (this.cardPool.length === 0) return;
    if (this.now < this.nextSpawnAt) return;
    const max = maxConcurrentAt(this.difficulty, this.now);
    if (this.enemies.length >= max) {
      this.nextSpawnAt = this.now + 250;
      return;
    }
    const card = this.nextCard();
    if (!card) return;
    const colour = this.deckColours.get(card.deckId) ?? "#888";
    const stats = statsForCard(card, colour);
    // Spawn just outside the visible field rim. The fieldRadius adapts
    // to viewport size in handleResize(), so phones get a tight 160px
    // play radius while desktops get ~480px — enemies always enter view
    // at the same fraction of viewport regardless of device.
    const angle = Math.random() * Math.PI * 2;
    const radius = this.fieldRadius * 1.15;
    const pos: Vec2 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    // Stack-up of stat modifiers, in order:
    //   1. statsForCard — base from the card's FSRS state.
    //   2. Difficulty config — easy/normal/hard/insane global knob.
    //   3. timeRampAt(now) — gradual ramp over the run so a 6-minute
    //      enemy is meaningfully tougher than a fresh one. Without
    //      this the run autoplayed once Drone Cannon hit L3.
    //   4. Field-radius scale — speed is multiplied by the ratio of
    //      this.fieldRadius to the design target (350) so traversal
    //      time stays constant across viewports. Without this, phones
    //      would feel ~3× faster than iPad because the field is
    //      smaller but speed stayed the same in px/s.
    //   5. Elite bonus — 1.5× HP + size on streaks ≥ 5.
    const ramp = timeRampAt(this.now);
    const fieldScale = this.fieldRadius / 350;
    const speed = stats.speed * this.difficulty.enemySpeedMult * ramp.speed * fieldScale;
    const baseHp = stats.hp * ramp.hp;
    const isElite =
      this.player.streak >= 5 &&
      Math.random() < 0.12 * (1 + this.player.eliteSpawnRateBoost);
    const finalHp = isElite ? baseHp * 1.5 : baseHp;
    this.enemies.push({
      id: newId(),
      card,
      pos,
      hp: finalHp,
      maxHp: finalHp,
      shape: stats.shape,
      size: stats.size + (isElite ? 6 : 0),
      colour: stats.colour,
      speed,
      contactDamage: Math.round(
        stats.contactDamage * this.difficulty.contactDamageMult * ramp.contact,
      ),
      seenThisRun: this.spawnedSelectedSet.has(card.id),
      elite: isElite,
      spawnedAt: this.now,
    });
    this.nextSpawnAt = this.now + spawnIntervalAt(this.difficulty, this.now);
  }

  private nextCard(): Card | null {
    if (this.cardPool.length === 0) return null;
    const card = this.cardPool[this.cardCursor % this.cardPool.length];
    this.cardCursor += 1;
    return card;
  }

  // ---- Updates ----

  private updateEnemies(dtMs: number): void {
    const sec = dtMs / 1000;
    for (const e of this.enemies) {
      const dist = Math.hypot(e.pos.x, e.pos.y);
      if (dist <= 1) continue; // already at centre, contact step will deal with it
      // Per-frame speed = base × distance multiplier. Far from centre
      // (off-screen approach) → fast: students don't have to watch a
      // shape crawl in. In the reading zone (close to player) → slow:
      // they get time to actually read, think, and type. Linear lerp
      // between the two for a smooth deceleration.
      const distMult = this.speedMultiplierAtDistance(dist);
      const v = e.speed * distMult;
      e.pos.x -= (e.pos.x / dist) * v * sec;
      e.pos.y -= (e.pos.y / dist) * v * sec;
    }
    // Sort enemies by distance to centre ascending — weapon behaviours
    // depend on this order (closestToCentre etc.).
    this.enemies.sort(
      (a, b) =>
        a.pos.x * a.pos.x + a.pos.y * a.pos.y -
        (b.pos.x * b.pos.x + b.pos.y * b.pos.y),
    );
  }

  private tickWeapons(dtMs: number): void {
    for (const w of this.weapons) {
      const def = getWeaponDef(w.id);
      if (!def) continue;
      def.tick(this.weaponHandle(def), w, dtMs);
    }
  }

  // An enemy counts as visible only when its whole sprite is inside the
  // viewport's *usable* area (excluding the tray reserve at the bottom).
  // Half-on-screen targets get skipped by auto-fire so the player never
  // sees a projectile chase something off the edge or behind the tray.
  private isFullyVisible(e: Enemy): boolean {
    const halfW = this.width / 2;
    const halfH = (this.height - this.trayReserve) / 2;
    const r = e.size / 2;
    return (
      Math.abs(e.pos.x) + r <= halfW &&
      Math.abs(e.pos.y) + r <= halfH
    );
  }

  // Inner zone — where Vigilance mastery + the player's gravitational
  // pull take effect. Scales with the field so on a phone the inner
  // zone is ~25% of play radius, same as on iPad.
  private innerZoneRadius(): number {
    return this.fieldRadius * 0.3;
  }

  // Distance-based speed curve. See FAST_MULT / SLOW_MULT constants.
  // Zone radii are 90% of fieldRadius (just inside the visible rim) and
  // 45% (well into the reading zone) so the curve scales with viewport.
  private speedMultiplierAtDistance(d: number): number {
    const fast = this.fieldRadius * 0.9;
    const slow = this.fieldRadius * 0.45;
    if (d >= fast) return FAST_MULT;
    if (d <= slow) return SLOW_MULT;
    const t = (d - slow) / (fast - slow);
    return SLOW_MULT + (FAST_MULT - SLOW_MULT) * t;
  }

  private weaponHandle(def: import("../weapons/types").WeaponDef): import("../weapons/types").WeaponHandle {
    return {
      now: this.now,
      // Filter to enemies whose full sprite is on-screen. Auto-targeting
      // weapons (Drone Cannon, Cite Chain, Diagram Compass, Mnemonic
      // Pulse, Streak Conductor, etc.) were happily firing at enemies
      // still off-screen, which from the player's perspective looked
      // like projectiles flying into the void. Restricting them to
      // fully-visible targets means the student sees every shot
      // connect with something they can see. Proximity-only weapons
      // (Echo Orbital, Mnemonic Pulse) are unaffected in practice
      // because off-screen enemies never satisfy their radius tests.
      enemies: this.enemies.filter((e) => this.isFullyVisible(e)),
      playerPos: { x: 0, y: 0 },
      damageMult: effectiveDamageMult(def.tags, this.tagBonus),
      areaMult: effectiveAreaMult(def.tags, this.tagBonus),
      cooldownMult: effectiveCooldownMult(def.tags, this.tagBonus),
      projectileSpeedMult: this.player.projectileSpeedMult,
      streak: this.player.streak,
      spawnProjectile: (p) => {
        this.projectiles.push({ ...p, id: newId() });
      },
      spawnCloud: (pos, radius, dps, durationMs, tag) => {
        this.clouds.push({
          id: newId(),
          pos: { x: pos.x, y: pos.y },
          radius,
          dps,
          expiresAt: this.now + durationMs,
          tag,
        });
      },
      dealDamage: (enemyId, amount, opts) => {
        const enemy = this.enemies.find((e) => e.id === enemyId);
        if (!enemy) return;
        if (enemy.killed) return;
        const inInner = Math.hypot(enemy.pos.x, enemy.pos.y) < this.innerZoneRadius();
        enemy.hp -= amount * (inInner ? this.innerZoneDamageMult : 1);
        this.pushHitPulse(enemy.pos, enemy.hp <= 0 ? "kill" : "hit");
        if (enemy.hp <= 0) {
          this.killEnemy(enemy);
          return;
        }
        // Continuous damage (Reasoning Beam, Echo Orbital) ticks
        // every frame on the same target — if we swap the card per
        // tick the question reshuffles ~60×/sec and becomes
        // un-answerable. Only discrete hits (Mnemonic Pulse burst,
        // Streak Conductor chain, projectile direct-damage) trigger
        // a swap.
        if (!opts?.continuous) this.swapEnemyCard(enemy);
      },
      spawnChain: (points, revealMs, fadeMs) => {
        this.pushChain(points, revealMs, fadeMs);
      },
      setBeam: (from, to, intensity) => {
        // Keyed by the weapon def's id so each beam-style weapon
        // (Reasoning Beam today, future Refraction Lance etc.) owns
        // one slot. Refreshing the slot each tick keeps it alive;
        // skipping a tick lets prunePulses time it out.
        this.beams.set(def.id, {
          from: { x: from.x, y: from.y },
          to: { x: to.x, y: to.y },
          intensity,
          lastSeen: this.now,
        });
      },
    };
  }

  private updateProjectiles(dtMs: number): void {
    const sec = dtMs / 1000;
    for (const p of this.projectiles) {
      if (p.homing) {
        const target = this.enemies.find((e) => e.id === p.homing);
        if (target) {
          const dx = target.pos.x - p.pos.x;
          const dy = target.pos.y - p.pos.y;
          const dist = Math.hypot(dx, dy) || 1;
          const speed = Math.hypot(p.vel.x, p.vel.y);
          // Blend velocity toward target — soft homing.
          p.vel.x = p.vel.x * 0.9 + (dx / dist) * speed * 0.1;
          p.vel.y = p.vel.y * 0.9 + (dy / dist) * speed * 0.1;
        }
      }
      p.pos.x += p.vel.x * sec;
      p.pos.y += p.vel.y * sec;
    }
  }

  private updateClouds(_dtMs: number): void {
    for (const c of this.clouds) {
      if (c.expiresAt < this.now) continue;
      for (const e of this.enemies) {
        const d = Math.hypot(e.pos.x - c.pos.x, e.pos.y - c.pos.y);
        if (d < c.radius) {
          const inInner = Math.hypot(e.pos.x, e.pos.y) < this.innerZoneRadius();
          e.hp -= (c.dps / 60) * (inInner ? this.innerZoneDamageMult : 1);
          if (e.hp <= 0) this.killEnemy(e);
        }
      }
    }
  }

  private resolveProjectileHits(): void {
    for (const p of this.projectiles) {
      if (p.pierce < -1) continue;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.killed) continue;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) <= e.size * 0.5 + p.radius) {
          const inInner = Math.hypot(e.pos.x, e.pos.y) < this.innerZoneRadius();
          e.hp -= p.damage * (inInner ? this.innerZoneDamageMult : 1);
          if (p.splitOnHit && p.splitOnHit > 0) {
            this.spawnSplits(p, e);
            p.splitOnHit = 0; // only split once per projectile
          }
          this.pushHitPulse(p.pos, e.hp <= 0 ? "kill" : "hit");
          if (e.hp <= 0) this.killEnemy(e);
          // Survived a discrete projectile hit — swap to a different
          // card. (DoT clouds don't go through this path so they don't
          // trigger swaps, which is the intended behaviour.)
          else this.swapEnemyCard(e);
          if (p.pierce > 0) {
            p.pierce -= 1;
            continue;
          }
          p.expiresAt = -1; // mark for removal
          break;
        }
      }
    }
  }

  private spawnSplits(parent: Projectile, hitEnemy: Enemy): void {
    const count = parent.splitOnHit ?? 0;
    if (count <= 0) return;
    for (let i = 0; i < count; i += 1) {
      const angle = Math.atan2(parent.vel.y, parent.vel.x) + (i + 1) * 0.6;
      const speed = Math.hypot(parent.vel.x, parent.vel.y) * 0.85;
      this.projectiles.push({
        id: newId(),
        pos: { x: hitEnemy.pos.x, y: hitEnemy.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        damage: parent.damage * 0.6,
        radius: parent.radius * 0.85,
        kind: parent.kind,
        pierce: parent.pierce,
        homing: null,
        sourceWeapon: parent.sourceWeapon,
        expiresAt: this.now + 1200,
      });
    }
  }

  private resolveContactHits(): void {
    for (const e of this.enemies) {
      const dist = Math.hypot(e.pos.x, e.pos.y);
      if (dist <= 18) {
        // Working Memory Buffer soaks the hit.
        if (this.bufferCharges > 0) {
          this.bufferCharges -= 1;
        } else {
          this.player.hp -= e.contactDamage;
        }
        e.hp = 0;
        // Streak resets on contact damage taken too.
        this.player.streak = 0;
      }
    }
    // Sync buffer charges from owned weapon level.
    const buf = this.weapons.find((w) => w.id === "working-memory-buffer");
    if (buf) {
      const maxCharges = [1, 2, 4, 6, 9][buf.level - 1];
      const respawn = [12000, 12000, 12000, 10000, 9000][buf.level - 1];
      const cdPrev = typeof buf.state.cd === "number" ? buf.state.cd : respawn;
      const cd = cdPrev - 16; // ~one frame's worth; approximate
      if (this.bufferCharges < maxCharges && cd <= 0) {
        this.bufferCharges += 1;
        buf.state.cd = respawn;
      } else {
        buf.state.cd = cd;
      }
    }
    if (this.player.hp <= 0) this.finishGame("death");
  }

  private killEnemy(enemy: Enemy): void {
    // Idempotency guard. Without this, an Elaboration Cloud spawned by
    // killEnemy lands on the corpse, the next iteration of updateClouds
    // damages the (still-in-list) dead enemy again, killEnemy fires
    // again, spawns another cloud at the same spot, and the loop
    // cascades — XP compounds, level-ups stack, and eventually the run
    // crashes. Mark the enemy killed on first call; subsequent calls in
    // the same tick are no-ops. pruneDead() removes the enemy at
    // end-of-tick.
    if (enemy.killed) return;
    enemy.killed = true;
    // Award XP scaled by max HP.
    const xpGained = Math.round(enemy.maxHp * 0.5 * this.player.xpGainMult);
    this.player.xp += xpGained;
    this.cardsKilled += 1;
    // Floating "+N XP" text. Elites get an additional callout so the
    // bonus XP (line below) reads as part of the same kill.
    this.pushFloater(enemy.pos, `+${xpGained} XP`, "rgb(255, 220, 110)");
    if (enemy.elite) {
      this.pushFloater(
        { x: enemy.pos.x, y: enemy.pos.y - 14 },
        "ELITE +30",
        "rgb(255, 200, 90)",
      );
    }
    // onKill hooks.
    for (const ow of this.weapons) {
      const def = getWeaponDef(ow.id);
      if (def?.onKill) {
        def.onKill(this.weaponHandle(def), ow, enemy, enemy.card);
      }
    }
    // Elite bonus upgrade roll deferred — accumulate as extra XP for now.
    if (enemy.elite) {
      this.player.xp += 30;
    }
    // Level-up check (may chain).
    while (this.player.xp >= this.player.xpToNextLevel) {
      this.player.xp -= this.player.xpToNextLevel;
      this.player.level += 1;
      this.player.xpToNextLevel = Math.round(XP_BASE * XP_GROWTH ** this.player.level);
      this.triggerLevelUp();
    }
  }

  private triggerLevelUp(): void {
    this.paused = true;
    const choices = rollUpgradeChoices(
      { weapons: this.weapons, weaponCap: this.weaponCap, player: this.player },
      3,
    );
    this.rerollsRemainingThisLevelUp = applyMasteryEffects(this.cfg.masteryNodes).rerollPerLevelUp;
    this.emit({ type: "levelUp", choices });
  }

  // Apply an upgrade picked from the modal and resume the engine.
  applyUpgrade(choice: UpgradeChoice): void {
    choice.apply({
      player: this.player,
      weapons: this.weapons,
      tagBonus: this.tagBonus,
      setTagBonus: (next) => {
        this.tagBonus = next;
      },
      addWeapon: (id) => {
        if (!WEAPONS_BY_ID.has(id)) return;
        if (this.weapons.some((w) => w.id === id)) return;
        if (this.weapons.length >= this.weaponCap) return;
        this.weapons.push(instantiate(id, 1));
      },
    });
    this.broadcastStats();
    this.paused = false;
    // Tell subscribers (TypingInput) the run is live again so they can
    // restore focus that the upgrade-button stole.
    this.emit({ type: "resume" });
  }

  rerollLevelUp(): UpgradeChoice[] {
    if (this.rerollsRemainingThisLevelUp <= 0) return [];
    this.rerollsRemainingThisLevelUp -= 1;
    return rollUpgradeChoices(
      { weapons: this.weapons, weaponCap: this.weaponCap, player: this.player },
      3,
    );
  }

  rerollsRemaining(): number {
    return this.rerollsRemainingThisLevelUp;
  }

  // ---- Lifecycle ----

  private pruneDead(): void {
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    this.projectiles = this.projectiles.filter(
      (p) => p.expiresAt > this.now && p.expiresAt !== -1,
    );
    this.clouds = this.clouds.filter((c) => c.expiresAt > this.now);
  }

  // Push a transient hit / kill pulse for the renderer to draw an
  // expanding ring at the given position. Kill pulses are bigger and
  // gold-tinted so the player can pick a kill out of a busy field.
  private pushHitPulse(pos: Vec2, kind: "hit" | "kill"): void {
    this.hitPulses.push({ pos: { x: pos.x, y: pos.y }, bornAt: this.now, kind });
  }

  private pushFloater(pos: Vec2, text: string, color: string): void {
    this.floaters.push({
      text,
      // Copy the position vector — enemies' pos is mutated as they
      // move, and we want the floater to stay where the kill happened.
      pos: { x: pos.x, y: pos.y },
      bornAt: this.now,
      color,
    });
  }

  private pushChain(points: Vec2[], revealMs = 220, fadeMs = 380): void {
    if (points.length < 2) return;
    this.chainBolts.push({
      points: points.map((p) => ({ x: p.x, y: p.y })),
      bornAt: this.now,
      revealMs,
      fadeMs,
    });
  }

  private prunePulses(): void {
    if (this.hitPulses.length > 0) {
      const cutoff = this.now - 600; // longest pulse lives ~500ms; 600 = buffer
      this.hitPulses = this.hitPulses.filter((p) => p.bornAt > cutoff);
    }
    if (this.floaters.length > 0) {
      const cutoff = this.now - 1000; // floater lifetime ~900ms
      this.floaters = this.floaters.filter((f) => f.bornAt > cutoff);
    }
    if (this.chainBolts.length > 0) {
      this.chainBolts = this.chainBolts.filter(
        (c) => this.now - c.bornAt < c.revealMs + c.fadeMs + 50,
      );
    }
    if (this.beams.size > 0) {
      // ~7 ticks of slack — if the weapon stops calling setBeam the
      // entry drops out and the visual disappears within ~120ms.
      for (const [key, b] of this.beams) {
        if (this.now - b.lastSeen > 120) this.beams.delete(key);
      }
    }
  }

  private onMiss(): void {
    if (!this.player.persistentRecallUsed) {
      // Persistent Recall mastery active — burn the once-per-run save.
      this.player.persistentRecallUsed = true;
      return;
    }
    this.player.streak = 0;
    this.broadcastStats();
  }

  private finishGame(cause: "death" | "quit"): void {
    if (this.gameOver) return;
    this.gameOver = true;
    this.paused = true;
    const durationMs = Math.max(0, this.now);
    const durationMin = durationMs / 60_000;
    const insight = Math.floor(
      (this.cardsKilled / 5 +
        (durationMin >= 5 ? 5 : 0) +
        (durationMin >= 10 ? 10 : 0) +
        this.bossesKilled * 3) *
        this.difficulty.insightMult,
    );
    const summary: RunSummary = {
      durationMs,
      cardsKilled: this.cardsKilled,
      bossesKilled: this.bossesKilled,
      finalLevel: this.player.level,
      weapons: this.weapons,
      bestStreak: this.player.bestStreak,
      difficulty: this.cfg.difficulty,
      inputMode: this.cfg.inputMode,
      decks: this.cfg.decks,
      insightEarned: insight,
      cause,
    };
    this.emit({ type: "gameOver", summary });
  }

  // ---- Emit ----

  private emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }

  private broadcastStats(): void {
    this.emit({ type: "stats", player: { ...this.player }, weapons: this.weapons.map((w) => ({ ...w, state: { ...w.state } })) });
  }
  private broadcastEnemyView(): void {
    const visible: EnemyView[] = this.enemies.map((e) => ({
      id: e.id,
      pos: { x: e.pos.x + this.centreX, y: e.pos.y + this.centreY },
      size: e.size,
      front: cardFront(e.card) || cardBack(e.card),
      selected: this.selectedEnemyId === e.id,
    }));
    this.emit({ type: "enemiesChanged", visible });
  }
}

// Shape drawer.
function drawShape(ctx: CanvasRenderingContext2D, shape: Enemy["shape"], r: number): void {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    return;
  }
  const sides =
    shape === "triangle" ? 3 :
    shape === "square" ? 4 :
    shape === "diamond" ? 4 :
    shape === "pentagon" ? 5 :
    shape === "hex" ? 6 : 6;
  const rotate = shape === "diamond" ? Math.PI / 4 : -Math.PI / 2;
  for (let i = 0; i < sides; i += 1) {
    const a = rotate + (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Saturated kind-specific tints used for projectile halos / trails.
// Brighter than the original muted palette so projectiles read clearly
// against any theme backdrop — kinetic = warm gold, energy = bright
// green, summon = vivid purple. Alpha is per-caller so we can build
// halos (low alpha) and motion ghosts (lower alpha) from the same base.
function projectileTint(kind: "kinetic" | "energy" | "summon", alpha = 1): string {
  const a = alpha.toFixed(3);
  switch (kind) {
    case "kinetic":
      return `rgba(255, 200, 90, ${a})`;
    case "energy":
      return `rgba(80, 220, 140, ${a})`;
    case "summon":
      return `rgba(190, 130, 255, ${a})`;
  }
}

// Re-emit a `rgb(r g b)` string with an alpha component. We can't use a
// dumb string replace because `rgb(...) / 0.5)` doesn't parse in every
// canvas implementation; building a real rgba() with the parsed channels
// is reliable everywhere.
function withAlpha(rgbStr: string, alpha: number): string {
  const m = rgbStr.match(/rgba?\(([^)]+)\)/);
  if (!m) return rgbStr;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
  return `rgba(${parts.join(", ")}, ${alpha.toFixed(3)})`;
}

// Multipliers used by GameEngine.speedMultiplierAtDistance(). Kept
// module-level so the constants live in one place without needing
// engine state. Zone *radii* (where the multipliers kick in) live on
// the engine because they derive from this.fieldRadius and scale with
// viewport.
const FAST_MULT = 1.7;
const SLOW_MULT = 0.55;

// Reads the theme palette out of CSS variables defined in index.css.
// The values are space-separated r g b channels (e.g. "250 247 242") so
// we wrap them in rgb() to get a valid canvas fill / stroke string. Falls
// back to readable defaults if the variable isn't set (shouldn't happen
// in practice, but keeps the engine safe if it loads before the theme
// stylesheet is parsed).
function readThemeColours(): GameEngine["colours"] {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      backdrop: "#0b1320",
      ink: "rgb(255 255 255)",
      inkMuted: "rgba(255,255,255,0.6)",
      innerZoneRing: "rgba(255,255,255,0.06)",
    };
  }
  const style = getComputedStyle(document.documentElement);
  const cream = style.getPropertyValue("--color-cream").trim() || "11 19 32";
  const ink900 = style.getPropertyValue("--color-ink-900").trim() || "240 240 240";
  return {
    backdrop: `rgb(${cream})`,
    ink: `rgb(${ink900})`,
    inkMuted: `rgb(${ink900} / 0.55)`,
    innerZoneRing: `rgb(${ink900} / 0.08)`,
  };
}
