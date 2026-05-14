// In-run upgrade pool (Survivors-Spec §2.8).
//
// On every level-up the engine rolls 3 distinct choices from the
// weighted categories: new weapon / weapon upgrade / tag upgrade /
// player upgrade / exotic upgrade.

import type { Tag, TagBonus, PlayerStats, OwnedWeapon } from "../engine/types";
import { WEAPONS } from "../weapons/registry";
import { addAreaBonus, addCooldownBonus, addDamageBonus } from "../engine/tagResolver";

export type UpgradeCategory =
  | "new-weapon"
  | "weapon-upgrade"
  | "tag-upgrade"
  | "player-upgrade"
  | "exotic";

export interface UpgradeChoice {
  id: string;
  category: UpgradeCategory;
  title: string;
  description: string;
  // For weapon-related choices (new-weapon, weapon-upgrade): the
  // weapon's tag list, surfaced as chips on the upgrade card so the
  // player can see "Recall Cannon — kinetic, synergy" and pair it
  // with kinetic / synergy tag upgrades on later level-ups.
  // Undefined for non-weapon categories.
  tags?: Tag[];
  // Apply mutates the player + weapon state in place. The engine
  // freezes time during the modal, so a synchronous mutation is fine.
  apply: (ctx: UpgradeContext) => void;
}

export interface UpgradeContext {
  player: PlayerStats;
  weapons: OwnedWeapon[];
  tagBonus: TagBonus;
  // For exotic upgrades that need to toggle a flag and have the
  // engine read it later.
  // (We return the new TagBonus via setTagBonus because objects are
  // immutable in our state design.)
  setTagBonus: (next: TagBonus) => void;
  addWeapon: (id: string) => void;
}

// Starting category weights from spec §2.8. After 5 weapons owned the
// new-weapon weight redistributes proportionally to the rest.
const BASE_WEIGHTS: Record<UpgradeCategory, number> = {
  "new-weapon": 0.45,
  "weapon-upgrade": 0.30,
  "tag-upgrade": 0.15,
  "player-upgrade": 0.07,
  exotic: 0.03,
};

const ALL_TAGS: Tag[] = ["kinetic", "energy", "summon", "support"];

// ---- Generators ----

function tagUpgrade(tag: Tag, kind: "damage" | "area" | "cooldown"): UpgradeChoice {
  const id = `tag-${tag}-${kind}`;
  const titles: Record<typeof kind, string> = {
    damage: `+10% ${tag} damage`,
    area: `+15% ${tag} area`,
    cooldown: `+8% ${tag} cooldown reduction`,
  };
  return {
    id,
    category: "tag-upgrade",
    title: titles[kind],
    description: `Stacks on every ${tag} weapon you own.`,
    apply: (ctx) => {
      if (kind === "damage") ctx.setTagBonus(addDamageBonus(ctx.tagBonus, tag, 0.10));
      if (kind === "area") ctx.setTagBonus(addAreaBonus(ctx.tagBonus, tag, 0.15));
      if (kind === "cooldown") ctx.setTagBonus(addCooldownBonus(ctx.tagBonus, tag, -0.08));
    },
  };
}

function playerHpUpgrade(): UpgradeChoice {
  return {
    id: "player-hp",
    category: "player-upgrade",
    title: "+15 max HP",
    description: "Both your max HP and current HP go up.",
    apply: (ctx) => {
      ctx.player.maxHp += 15;
      ctx.player.hp = Math.min(ctx.player.hp + 15, ctx.player.maxHp);
    },
  };
}

function playerXpUpgrade(): UpgradeChoice {
  return {
    id: "player-xp",
    category: "player-upgrade",
    title: "+10% XP gain",
    description: "Level up faster.",
    apply: (ctx) => {
      ctx.player.xpGainMult *= 1.1;
    },
  };
}

function playerProjectileSpeedUpgrade(): UpgradeChoice {
  return {
    id: "player-projectile-speed",
    category: "player-upgrade",
    title: "+5% projectile speed",
    description: "All projectiles travel faster.",
    apply: (ctx) => {
      ctx.player.projectileSpeedMult *= 1.05;
    },
  };
}

function exoticBossDrops(): UpgradeChoice {
  return {
    id: "exotic-boss-drops",
    category: "exotic",
    title: "Boss kills drop 2 upgrades",
    description: "Next time you down a boss, you'll get two picks instead of one.",
    apply: (ctx) => {
      ctx.player.bossKillsDropTwoUpgrades = true;
    },
  };
}

function exoticEliteSpawn(): UpgradeChoice {
  return {
    id: "exotic-elite-spawn",
    category: "exotic",
    title: "Elite cards spawn 50% more often",
    description: "Riskier, but elites drop extra upgrade rolls.",
    apply: (ctx) => {
      ctx.player.eliteSpawnRateBoost += 0.5;
    },
  };
}

function exoticPersistentRecall(): UpgradeChoice {
  return {
    id: "exotic-persistent-recall",
    category: "exotic",
    title: "Streak survives one miss",
    description: "Once per run, a wrong answer won't break your streak.",
    apply: (ctx) => {
      ctx.player.persistentRecallUsed = false; // ready
    },
  };
}

// ---- Roll ----

function weightedPick<T>(items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((s, it) => s + it.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    if (r < it.weight) return it.item;
    r -= it.weight;
  }
  return items[items.length - 1].item;
}

export function rollUpgradeChoices(
  context: { weapons: OwnedWeapon[]; weaponCap: number; player: PlayerStats },
  count = 3,
): UpgradeChoice[] {
  const ownedIds = new Set(context.weapons.map((w) => w.id));
  const owned = WEAPONS.filter((w) => ownedIds.has(w.id));
  const upgradeable = owned.filter((w) => {
    const o = context.weapons.find((x) => x.id === w.id);
    return (o?.level ?? 5) < 5;
  });
  const newPool = WEAPONS.filter((w) => !ownedIds.has(w.id));

  const weights: Record<UpgradeCategory, number> = { ...BASE_WEIGHTS };
  const atCap = ownedIds.size >= context.weaponCap;
  if (atCap || newPool.length === 0) {
    // Redistribute proportionally per spec.
    const removed = weights["new-weapon"];
    weights["new-weapon"] = 0;
    const totalRest =
      weights["weapon-upgrade"] +
      weights["tag-upgrade"] +
      weights["player-upgrade"] +
      weights.exotic;
    if (totalRest > 0) {
      const factor = (totalRest + removed) / totalRest;
      weights["weapon-upgrade"] *= factor;
      weights["tag-upgrade"] *= factor;
      weights["player-upgrade"] *= factor;
      weights.exotic *= factor;
    }
  }

  const picked: UpgradeChoice[] = [];
  const pickedIds = new Set<string>();
  let safety = 0;

  while (picked.length < count && safety < 50) {
    safety += 1;
    const category = weightedPick<UpgradeCategory>([
      { item: "new-weapon", weight: weights["new-weapon"] },
      { item: "weapon-upgrade", weight: weights["weapon-upgrade"] },
      { item: "tag-upgrade", weight: weights["tag-upgrade"] },
      { item: "player-upgrade", weight: weights["player-upgrade"] },
      { item: "exotic", weight: weights.exotic },
    ]);
    if (!category) break;
    let choice: UpgradeChoice | null = null;
    switch (category) {
      case "new-weapon": {
        const pick = newPool[Math.floor(Math.random() * newPool.length)];
        if (!pick) break;
        choice = {
          id: `new-${pick.id}`,
          category: "new-weapon",
          title: `NEW · ${pick.name}`,
          // Tags are surfaced as dedicated chips on the card now, so
          // we no longer pack them into the description's free-text.
          description: pick.description,
          tags: [...pick.tags],
          apply: (ctx) => ctx.addWeapon(pick.id),
        };
        break;
      }
      case "weapon-upgrade": {
        const pick = upgradeable[Math.floor(Math.random() * upgradeable.length)];
        if (!pick) break;
        const owned = context.weapons.find((w) => w.id === pick.id);
        const nextLevel = (owned?.level ?? 0) + 1;
        choice = {
          id: `up-${pick.id}-${nextLevel}`,
          category: "weapon-upgrade",
          title: `${pick.name} → L${nextLevel}`,
          description: pick.perLevel[nextLevel - 1] ?? pick.description,
          tags: [...pick.tags],
          apply: (ctx) => {
            const w = ctx.weapons.find((x) => x.id === pick.id);
            if (w && w.level < 5) w.level += 1;
          },
        };
        break;
      }
      case "tag-upgrade": {
        const tag = ALL_TAGS[Math.floor(Math.random() * ALL_TAGS.length)];
        const kind = (["damage", "area", "cooldown"] as const)[Math.floor(Math.random() * 3)];
        choice = tagUpgrade(tag, kind);
        break;
      }
      case "player-upgrade": {
        const opts = [playerHpUpgrade(), playerXpUpgrade(), playerProjectileSpeedUpgrade()];
        choice = opts[Math.floor(Math.random() * opts.length)];
        break;
      }
      case "exotic": {
        const opts = [exoticBossDrops(), exoticEliteSpawn(), exoticPersistentRecall()];
        choice = opts[Math.floor(Math.random() * opts.length)];
        break;
      }
    }
    if (choice && !pickedIds.has(choice.id)) {
      picked.push(choice);
      pickedIds.add(choice.id);
    }
  }

  return picked;
}
