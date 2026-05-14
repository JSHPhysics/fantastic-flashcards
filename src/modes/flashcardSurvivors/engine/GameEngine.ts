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
const INNER_ZONE_RADIUS = 110; // px from centre — Vigilance bonus applies inside

export class GameEngine {
  // ---- Canvas + loop state ----
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private centreX = 0;
  private centreY = 0;
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
  // canvas backdrop + the player turret + enemy outlines all use these
  // so the game adopts whichever theme is active. A theme change during
  // a run only takes effect on the next run — acceptable trade-off
  // since theme changes mid-game are vanishingly rare.
  private colours = {
    backdrop: "#0b1320",
    ink: "rgb(255 255 255)",
    inkMuted: "rgba(255,255,255,0.6)",
    innerZoneRing: "rgba(255,255,255,0.06)",
  };

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
  }
  handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.centreX = this.width / 2;
    this.centreY = this.height / 2;
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

  // For Tap mode: try to find an enemy under a canvas-space point.
  pickEnemyAt(canvasX: number, canvasY: number): Enemy | null {
    // canvas coords -> centre coords
    const x = canvasX - this.centreX;
    const y = canvasY - this.centreY;
    // Iterate in reverse-draw order so visually-topmost wins.
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      const dx = x - e.pos.x;
      const dy = y - e.pos.y;
      if (Math.hypot(dx, dy) <= e.size * 0.6) return e;
    }
    return null;
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
    ctx.arc(0, 0, INNER_ZONE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    // Clouds (DoT).
    for (const c of this.clouds) {
      ctx.fillStyle = "rgba(200,255,200,0.18)";
      ctx.beginPath();
      ctx.arc(c.pos.x, c.pos.y, c.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Echo Orbital — draw orbs.
    const echo = this.weapons.find((w) => w.id === "echo-orbital");
    if (echo) {
      const lvl = echo.level - 1;
      const orbs = [2, 2, 3, 3, 4][lvl];
      const radius = [100, 120, 120, 140, 140][lvl];
      const theta = (echo.state.theta ?? 0) as number;
      ctx.fillStyle = "rgba(130,200,255,0.85)";
      for (let i = 0; i < orbs; i += 1) {
        const a = theta + (i / orbs) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * radius, Math.sin(a) * radius, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Enemies.
    for (const e of this.enemies) {
      this.drawEnemy(e);
    }
    // Projectiles.
    for (const p of this.projectiles) {
      ctx.fillStyle =
        p.kind === "kinetic"
          ? "#FFF"
          : p.kind === "energy"
            ? "rgba(160,255,180,0.95)"
            : "rgba(220,200,255,0.95)";
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
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
    // Spawn at random edge angle, just outside the screen radius.
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.max(this.width, this.height) * 0.55;
    const pos: Vec2 = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    // Final speed = card-derived base × difficulty multiplier. The card
    // pool already factored in reading time + retrievability; difficulty
    // adds the global "how merciful is this run" knob (easy 0.7,
    // normal 1.0, hard 1.2, insane 1.4).
    const speed = stats.speed * this.difficulty.enemySpeedMult;
    const vel: Vec2 = {
      x: -Math.cos(angle) * speed,
      y: -Math.sin(angle) * speed,
    };
    const isElite =
      this.player.streak >= 5 &&
      Math.random() < 0.12 * (1 + this.player.eliteSpawnRateBoost);
    this.enemies.push({
      id: newId(),
      card,
      pos,
      vel,
      hp: isElite ? stats.hp * 1.5 : stats.hp,
      maxHp: isElite ? stats.hp * 1.5 : stats.hp,
      shape: stats.shape,
      size: stats.size + (isElite ? 6 : 0),
      colour: stats.colour,
      speed,
      contactDamage: Math.round(stats.contactDamage * this.difficulty.contactDamageMult),
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
      // Constant drift toward centre (vel set at spawn).
      e.pos.x += e.vel.x * sec;
      e.pos.y += e.vel.y * sec;
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

  private weaponHandle(def: import("../weapons/types").WeaponDef): import("../weapons/types").WeaponHandle {
    return {
      now: this.now,
      enemies: this.enemies,
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
      dealDamage: (enemyId, amount) => {
        const enemy = this.enemies.find((e) => e.id === enemyId);
        if (!enemy) return;
        const inInner = Math.hypot(enemy.pos.x, enemy.pos.y) < INNER_ZONE_RADIUS;
        enemy.hp -= amount * (inInner ? this.innerZoneDamageMult : 1);
        if (enemy.hp <= 0) this.killEnemy(enemy);
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
          const inInner = Math.hypot(e.pos.x, e.pos.y) < INNER_ZONE_RADIUS;
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
        if (e.hp <= 0) continue;
        if (Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) <= e.size * 0.5 + p.radius) {
          const inInner = Math.hypot(e.pos.x, e.pos.y) < INNER_ZONE_RADIUS;
          e.hp -= p.damage * (inInner ? this.innerZoneDamageMult : 1);
          if (p.splitOnHit && p.splitOnHit > 0) {
            this.spawnSplits(p, e);
            p.splitOnHit = 0; // only split once per projectile
          }
          if (e.hp <= 0) this.killEnemy(e);
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
    // Award XP scaled by max HP.
    const xpGained = Math.round(enemy.maxHp * 0.5 * this.player.xpGainMult);
    this.player.xp += xpGained;
    this.cardsKilled += 1;
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
