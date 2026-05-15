// All 12 v1 weapons (Survivors-Spec §2.7). One file rather than 12 because
// each behaviour is small and they share patterns — easier to balance
// when they sit side-by-side.

import type { Enemy, OwnedWeapon, Vec2 } from "../engine/types";
import type { WeaponDef } from "./types";

const TAU = Math.PI * 2;

// Reads a number out of weapon state with a fallback. OwnedWeapon.state
// is loosely typed (`Record<string, unknown>`) so each weapon can store
// whatever it needs; arithmetic accesses go through this helper to keep
// TypeScript happy without scattering `as number` casts.
function num(state: Record<string, unknown>, key: string, fallback = 0): number {
  const v = state[key];
  return typeof v === "number" ? v : fallback;
}

// Small helpers ----

function lengthOf(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}
function normalise(v: Vec2): Vec2 {
  const l = lengthOf(v);
  if (l === 0) return { x: 0, y: 0 };
  return { x: v.x / l, y: v.y / l };
}
function lowestHpEnemy(enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (!best || e.hp < best.hp) best = e;
  }
  return best;
}
function highestHpEnemy(enemies: Enemy[]): Enemy | null {
  let best: Enemy | null = null;
  for (const e of enemies) {
    if (!best || e.hp > best.hp) best = e;
  }
  return best;
}
function closestToCentre(enemies: Enemy[]): Enemy | null {
  return enemies[0] ?? null;
}

// Weapon factory pattern — keeps boilerplate down. Each entry below
// drops a partial def and we splice in id/tags/etc.

const W: WeaponDef[] = [
  // 1. Recall Cannon — always equipped at run start. Fires on correct
  //    answer. Damage = base + speed bonus (faster = up to 2x).
  {
    id: "recall-cannon",
    name: "Recall Cannon",
    tags: ["kinetic", "synergy"],
    description: "Fires the moment you nail a card. Faster answer = bigger hit.",
    perLevel: [
      "Damage 14, projectile speed 600.",
      "Damage 18.",
      "Damage 22, +1 pierce.",
      "Damage 27.",
      "Damage 34, +2 pierce.",
    ],
    tick: () => {
      /* event-driven — fires inside onCorrectAnswer */
    },
    onCorrectAnswer: (h, w, enemy, speedBonus) => {
      const baseByLevel = [14, 18, 22, 27, 34];
      const pierceByLevel = [0, 0, 1, 1, 2];
      const lvl = w.level - 1;
      const damage = baseByLevel[lvl] * speedBonus * h.damageMult;
      const dir = normalise({ x: enemy.pos.x, y: enemy.pos.y });
      const speed = 600 * h.projectileSpeedMult;
      h.spawnProjectile({
        pos: { x: 0, y: 0 },
        vel: { x: dir.x * speed, y: dir.y * speed },
        damage,
        radius: 6,
        kind: "kinetic",
        pierce: pierceByLevel[lvl],
        homing: null,
        sourceWeapon: "recall-cannon",
        expiresAt: h.now + 2000,
      });
    },
  },

  // 2. Echo Orbital — N orbs rotate around the player; contact damage.
  {
    id: "echo-orbital",
    name: "Echo Orbital",
    tags: ["energy", "summon"],
    description: "Orbs circle you, bumping into enemies.",
    perLevel: [
      "2 orbs at 100 radius, damage 6 / s.",
      "2 orbs, radius 120, damage 8 / s.",
      "3 orbs, damage 10 / s.",
      "3 orbs, radius 140, damage 13 / s.",
      "4 orbs, damage 17 / s.",
    ],
    tick: (h, w, dtMs) => {
      const lvl = w.level - 1;
      const orbs = [2, 2, 3, 3, 4][lvl];
      const radius = [100, 120, 120, 140, 140][lvl] * h.areaMult;
      const dps = [6, 8, 10, 13, 17][lvl] * h.damageMult;
      const theta = (num(w.state, "theta") + dtMs * 0.0025) % TAU;
      w.state.theta = theta;
      // Damage every enemy whose distance to any orb is < orb radius (10).
      for (let i = 0; i < orbs; i += 1) {
        const angle = theta + (i / orbs) * TAU;
        const ox = Math.cos(angle) * radius;
        const oy = Math.sin(angle) * radius;
        for (const e of h.enemies) {
          const dx = e.pos.x - ox;
          const dy = e.pos.y - oy;
          if (Math.hypot(dx, dy) < e.size * 0.5 + 10) {
            h.dealDamage(e.id, (dps * dtMs) / 1000);
          }
        }
      }
    },
  },

  // 3. Mnemonic Pulse — periodic shockwave radiating from player.
  {
    id: "mnemonic-pulse",
    name: "Mnemonic Pulse",
    tags: ["energy"],
    description: "Releases a ring of force around you on a timer.",
    perLevel: [
      "Damage 24, radius 180, every 6 s.",
      "Damage 32, every 5.5 s.",
      "Damage 42, radius 220, every 5 s.",
      "Damage 56, every 4.5 s.",
      "Damage 75, radius 260, every 4 s.",
    ],
    tick: (h, w, dtMs) => {
      const lvl = w.level - 1;
      const damage = [24, 32, 42, 56, 75][lvl] * h.damageMult;
      const radius = [180, 180, 220, 220, 260][lvl] * h.areaMult;
      const interval = [6000, 5500, 5000, 4500, 4000][lvl] * h.cooldownMult;
      const cd = num(w.state, "cd", interval) - dtMs;
      if (cd <= 0) {
        w.state.cd = interval;
        for (const e of h.enemies) {
          if (Math.hypot(e.pos.x, e.pos.y) < radius) {
            h.dealDamage(e.id, damage);
          }
        }
      } else {
        w.state.cd = cd;
      }
    },
  },

  // 4. Recap Volley — extra projectile on correct answer for cards seen
  //    earlier in the run.
  {
    id: "recap-volley",
    name: "Recap Volley",
    tags: ["kinetic", "synergy"],
    description:
      "Cards you've already nailed this run get a second projectile from Recall Cannon.",
    perLevel: [
      "+1 projectile on repeat card.",
      "+1 projectile, +25% damage.",
      "+2 projectiles on repeat card.",
      "+2 projectiles, +40% damage.",
      "+3 projectiles, +60% damage.",
    ],
    tick: () => {},
    onCorrectAnswer: (h, w, enemy) => {
      if (!enemy.seenThisRun) return;
      const lvl = w.level - 1;
      const count = [1, 1, 2, 2, 3][lvl];
      const dmgMult = [1, 1.25, 1, 1.4, 1.6][lvl] * h.damageMult;
      const damage = 12 * dmgMult;
      const speed = 540 * h.projectileSpeedMult;
      for (let i = 0; i < count; i += 1) {
        // Slight angular spread so they don't fully overlap.
        const baseAngle = Math.atan2(enemy.pos.y, enemy.pos.x);
        const spread = (i - (count - 1) / 2) * 0.18;
        const angle = baseAngle + spread;
        h.spawnProjectile({
          pos: { x: 0, y: 0 },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          damage,
          radius: 5,
          kind: "kinetic",
          pierce: 0,
          homing: null,
          sourceWeapon: "recap-volley",
          expiresAt: h.now + 2000,
        });
      }
    },
  },

  // 5. Spaced Salvo — on kill of a low-R card, fires 3-projectile spread
  //    at nearest enemies.
  {
    id: "spaced-salvo",
    name: "Spaced Salvo",
    tags: ["kinetic", "synergy"],
    description:
      "Killing a card you've been forgetting (low retrievability) showers nearby enemies.",
    perLevel: [
      "3 projectiles, damage 14.",
      "3 projectiles, damage 19.",
      "5 projectiles, damage 22.",
      "5 projectiles, damage 30.",
      "7 projectiles, damage 38.",
    ],
    tick: () => {},
    onKill: (h, w, enemy) => {
      const fsrs = enemy.card.fsrs as {
        stability?: number;
        elapsed_days?: number;
      };
      const stability = fsrs.stability ?? 1;
      const elapsed = fsrs.elapsed_days ?? 0;
      const retrievability =
        stability > 0 ? Math.exp(-elapsed / stability) : 1;
      if (retrievability >= 0.6) return;
      const lvl = w.level - 1;
      const count = [3, 3, 5, 5, 7][lvl];
      const damage = [14, 19, 22, 30, 38][lvl] * h.damageMult;
      const speed = 520 * h.projectileSpeedMult;
      const enemies = h.enemies.slice(0, count);
      for (let i = 0; i < count; i += 1) {
        const target = enemies[i] ?? enemies[0];
        if (!target) return;
        const dir = normalise({ x: target.pos.x, y: target.pos.y });
        h.spawnProjectile({
          pos: { x: 0, y: 0 },
          vel: { x: dir.x * speed, y: dir.y * speed },
          damage,
          radius: 5,
          kind: "kinetic",
          pierce: 0,
          homing: target.id,
          sourceWeapon: "spaced-salvo",
          expiresAt: h.now + 2200,
        });
      }
    },
  },

  // 6. Confidence Spike — charges with streak; fires a piercing shot at
  //    the highest-HP enemy when fully charged.
  {
    id: "confidence-spike",
    name: "Confidence Spike",
    tags: ["kinetic"],
    description:
      "Builds with your answer streak; fires a piercing shot at the toughest target.",
    perLevel: [
      "Charge at streak 8. Damage 50.",
      "Charge at streak 7. Damage 70.",
      "Charge at streak 6. Damage 95.",
      "Charge at streak 5. Damage 130.",
      "Charge at streak 4. Damage 180.",
    ],
    tick: (h, w) => {
      const lvl = w.level - 1;
      const threshold = [8, 7, 6, 5, 4][lvl];
      if (h.streak < threshold) return;
      if (num(w.state, "lastFiredAt") > h.now - 1500) return;
      const target = highestHpEnemy(h.enemies);
      if (!target) return;
      const damage = [50, 70, 95, 130, 180][lvl] * h.damageMult;
      const speed = 800 * h.projectileSpeedMult;
      const dir = normalise({ x: target.pos.x, y: target.pos.y });
      h.spawnProjectile({
        pos: { x: 0, y: 0 },
        vel: { x: dir.x * speed, y: dir.y * speed },
        damage,
        radius: 8,
        kind: "kinetic",
        pierce: 99,
        homing: null,
        sourceWeapon: "confidence-spike",
        expiresAt: h.now + 1800,
      });
      w.state.lastFiredAt = h.now;
    },
  },

  // 7. Reasoning Beam — continuous beam locks the lowest-HP enemy and
  //    ramps damage the longer it stays on one target.
  {
    id: "reasoning-beam",
    name: "Reasoning Beam",
    tags: ["energy"],
    description: "A focused beam that gets meaner the longer it's on one enemy.",
    perLevel: [
      "Base DPS 18, ramps to 36 over 2 s.",
      "Base DPS 24, ramps to 48.",
      "Base DPS 32, ramps to 64.",
      "Base DPS 42, ramps to 84.",
      "Base DPS 56, ramps to 112.",
    ],
    tick: (h, w, dtMs) => {
      const lvl = w.level - 1;
      const baseDps = [18, 24, 32, 42, 56][lvl] * h.damageMult;
      const peakDps = baseDps * 2;
      const target = lowestHpEnemy(h.enemies);
      if (!target) {
        w.state.lockId = null;
        w.state.lockedFor = 0;
        return;
      }
      const lockedOnSame = w.state.lockId === target.id;
      w.state.lockId = target.id;
      const prev = (w.state.lockedFor as number | undefined) ?? 0;
      w.state.lockedFor = lockedOnSame ? prev + dtMs : 0;
      const ramp = Math.min(1, ((w.state.lockedFor as number) ?? 0) / 2000);
      const dps = baseDps + (peakDps - baseDps) * ramp;
      h.dealDamage(target.id, (dps * dtMs) / 1000);
    },
  },

  // 8. Forgetting Sentry — autonomous drone, prioritises enemies closest
  //    to centre.
  {
    id: "forgetting-sentry",
    name: "Forgetting Sentry",
    tags: ["summon"],
    description:
      "Drone that hunts the closest threat — saves you when the perimeter starts collapsing.",
    perLevel: [
      "1 drone, damage 12 per shot, 1.2 s cooldown.",
      "1 drone, damage 16.",
      "2 drones.",
      "2 drones, damage 22.",
      "3 drones, damage 28.",
    ],
    tick: (h, w, dtMs) => {
      const lvl = w.level - 1;
      const droneCount = [1, 1, 2, 2, 3][lvl];
      const damage = [12, 16, 16, 22, 28][lvl] * h.damageMult;
      const interval = 1200 * h.cooldownMult;
      const cd = num(w.state, "cd", interval) - dtMs;
      if (cd > 0) {
        w.state.cd = cd;
        return;
      }
      const target = closestToCentre(h.enemies);
      if (!target) return;
      w.state.cd = interval;
      for (let i = 0; i < droneCount; i += 1) {
        const angle = Math.atan2(target.pos.y, target.pos.x) + (i - droneCount / 2) * 0.12;
        const speed = 500 * h.projectileSpeedMult;
        h.spawnProjectile({
          pos: { x: 0, y: 0 },
          vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
          damage,
          radius: 5,
          kind: "summon",
          pierce: 0,
          homing: target.id,
          sourceWeapon: "forgetting-sentry",
          expiresAt: h.now + 2500,
        });
      }
    },
  },

  // 9. Schema Splitter — Recall-Cannon projectiles split into 2 on hit.
  //    Engine reads splitOnHit on projectiles to do the work.
  {
    id: "schema-splitter",
    name: "Schema Splitter",
    tags: ["kinetic"],
    description:
      "Your Recall Cannon shots split into two on hit. Splits split.",
    perLevel: [
      "Splits once.",
      "Splits once, +20% damage.",
      "Splits twice.",
      "Splits twice, splits pierce one extra enemy.",
      "Splits three times, +40% damage.",
    ],
    tick: () => {},
    onCorrectAnswer: (_h, _w) => {
      // No direct fire — the engine handles the split mark when it
      // processes Recall Cannon's onCorrectAnswer by checking if the
      // player owns this weapon. See GameEngine.onCorrectAnswer.
    },
  },

  // 10. Working Memory Buffer — absorbs N contact hits then respawns.
  {
    id: "working-memory-buffer",
    name: "Working Memory Buffer",
    tags: ["support", "summon"],
    description: "Defensive orb soaks contact hits for you, respawns on a cooldown.",
    perLevel: [
      "1 orb, soaks 1 hit, 12 s respawn.",
      "1 orb, soaks 2 hits.",
      "2 orbs, 2 hits each.",
      "2 orbs, 3 hits, 10 s respawn.",
      "3 orbs, 3 hits, 9 s respawn.",
    ],
    tick: (_h, _w) => {
      // Behaviour is engine-handled: contact-collision step checks
      // for active buffer charges and decrements them before applying
      // damage to the player. The weapon's level controls the charge
      // count which the engine reads on every contact.
    },
  },

  // 11. Streak Conductor — at streak 10 releases chain lightning.
  {
    id: "streak-conductor",
    name: "Streak Conductor",
    tags: ["energy", "synergy"],
    description: "Builds with your streak; lightning chains across enemies at 10.",
    perLevel: [
      "Chains to 5, damage 32.",
      "Chains to 6, damage 42.",
      "Chains to 7, damage 56.",
      "Chains to 8, damage 75.",
      "Chains to 10, damage 100.",
    ],
    tick: (h, w) => {
      // Rising-edge fire: clear our marker whenever streak drops below
      // 10 so the next time it climbs back up, the volley fires again.
      if (h.streak < 10) {
        w.state.lastStreak = null;
        return;
      }
      if (w.state.lastStreak === h.streak) return;
      w.state.lastStreak = h.streak;
      const lvl = w.level - 1;
      const chains = [5, 6, 7, 8, 10][lvl];
      const damage = [32, 42, 56, 75, 100][lvl] * h.damageMult;
      const enemies = h.enemies.slice(0, chains);
      // Sequential reveal: the chain animates one segment at a time
      // (player → e0 → e1 → …) so the player sees the lightning hop
      // between targets instead of every enemy exploding at once.
      // Damage is applied on the same tick — the visual is decorative.
      if (enemies.length > 0) {
        const points = [h.playerPos, ...enemies.map((e) => e.pos)];
        // Roughly 70ms per segment up to 350ms total, then a 400ms
        // fade. Feels punchy on a 5-chain, doesn't drag on a 10-chain.
        const reveal = Math.min(350, 70 * (points.length - 1));
        h.spawnChain(points, reveal, 400);
      }
      for (const e of enemies) {
        h.dealDamage(e.id, damage);
      }
    },
  },

  // 12. Elaboration Cloud — DoT cloud at the kill location; bigger if
  //     consecutive kills share a tag.
  {
    id: "elaboration-cloud",
    name: "Elaboration Cloud",
    tags: ["energy", "synergy"],
    description:
      "On kill, leaves a cloud of damage where the enemy died. Same-topic kills make bigger clouds.",
    perLevel: [
      "Radius 60, DPS 10, 3 s.",
      "Radius 75, DPS 14, 3 s.",
      "Radius 90, DPS 19, 4 s.",
      "Radius 110, DPS 26, 4 s.",
      "Radius 140, DPS 36, 5 s.",
    ],
    tick: () => {},
    onKill: (h, w, enemy, _card) => {
      const lvl = w.level - 1;
      const baseRadius = [60, 75, 90, 110, 140][lvl] * h.areaMult;
      const dps = [10, 14, 19, 26, 36][lvl] * h.damageMult;
      const duration = [3000, 3000, 4000, 4000, 5000][lvl];
      const tag = enemy.card.tags[0] ?? null;
      // +40% radius when consecutive kills share the same primary tag.
      const same = tag !== null && w.state.lastTag === tag;
      w.state.lastTag = tag;
      const radius = baseRadius * (same ? 1.4 : 1);
      h.spawnCloud(enemy.pos, radius, dps, duration, tag);
    },
  },
];

export const WEAPONS: WeaponDef[] = W;
export const WEAPONS_BY_ID = new Map(W.map((w) => [w.id, w]));

export function getWeaponDef(id: string): WeaponDef | undefined {
  return WEAPONS_BY_ID.get(id);
}

// Creates a fresh OwnedWeapon at level 1 with empty state.
export function instantiate(id: string, level = 1): OwnedWeapon {
  return { id, level, state: {} };
}
