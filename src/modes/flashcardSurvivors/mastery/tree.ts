// Mastery Tree (Survivors-Spec §2.9).
//
// 12 nodes across 3 tiers. Tier 2 requires any 2 Tier-1 nodes purchased;
// Tier 3 requires any 2 Tier-2 nodes purchased. Nodes are permanent in
// v1 — no refunds. Effects are applied at run start by `effects.ts`.

export type MasteryNodeId =
  | "mnemonic-reserve"
  | "quick-study"
  | "practiced-hands"
  | "persistent-recall"
  | "reroll-insight"
  | "boss-wisdom"
  | "vigilance"
  | "diligent-practice"
  | "synergy-theorist"
  | "boundless-arsenal"
  | "elite-spawning"
  | "forgotten-mastery";

export type MasteryTier = 1 | 2 | 3;

export interface MasteryNode {
  id: MasteryNodeId;
  name: string;
  tier: MasteryTier;
  cost: number;
  description: string;
}

export const MASTERY_NODES: MasteryNode[] = [
  // Tier 1
  {
    id: "mnemonic-reserve",
    name: "Mnemonic Reserve",
    tier: 1,
    cost: 20,
    description: "+20 starting HP every run.",
  },
  {
    id: "quick-study",
    name: "Quick Study",
    tier: 1,
    cost: 20,
    description: "+10% XP gain.",
  },
  {
    id: "practiced-hands",
    name: "Practiced Hands",
    tier: 1,
    cost: 25,
    description: "+5% projectile speed at run start.",
  },
  {
    id: "persistent-recall",
    name: "Persistent Recall",
    tier: 1,
    cost: 30,
    description: "First miss per run doesn't break your streak.",
  },
  // Tier 2
  {
    id: "reroll-insight",
    name: "Reroll Insight",
    tier: 2,
    cost: 60,
    description: "1 reroll available per level-up modal.",
  },
  {
    id: "boss-wisdom",
    name: "Boss Wisdom",
    tier: 2,
    cost: 60,
    description: "Boss kills offer 4 upgrade choices instead of 3.",
  },
  {
    id: "vigilance",
    name: "Vigilance",
    tier: 2,
    cost: 70,
    description: "+15% damage to enemies in the inner zone (close to centre).",
  },
  {
    id: "diligent-practice",
    name: "Diligent Practice",
    tier: 2,
    cost: 80,
    description: "Start each run with Recall Cannon at L2.",
  },
  // Tier 3
  {
    id: "synergy-theorist",
    name: "Synergy Theorist",
    tier: 3,
    cost: 150,
    description: "Tag upgrades count as 2 stacks each.",
  },
  {
    id: "boundless-arsenal",
    name: "Boundless Arsenal",
    tier: 3,
    cost: 180,
    description: "Weapon cap increased from 5 to 6.",
  },
  {
    id: "elite-spawning",
    name: "Elite Spawning",
    tier: 3,
    cost: 150,
    description: "+25% elite spawn rate, +20% XP from elites (risk / reward).",
  },
  {
    id: "forgotten-mastery",
    name: "Forgotten Mastery",
    tier: 3,
    cost: 250,
    description: "Unlocks Insane difficulty (×3 Insight multiplier).",
  },
];

const TIER_REQUIREMENT: Record<MasteryTier, number> = { 1: 0, 2: 2, 3: 2 };

// Returns true if the node can be purchased: not already owned, prereqs
// in earlier tiers satisfied, balance >= cost.
export function canPurchase(
  node: MasteryNode,
  unlocked: readonly string[],
  balance: number,
): boolean {
  if (unlocked.includes(node.id)) return false;
  if (balance < node.cost) return false;
  if (node.tier === 1) return true;
  const prevTier = (node.tier - 1) as MasteryTier;
  const ownedInPrevTier = MASTERY_NODES.filter(
    (n) => n.tier === prevTier && unlocked.includes(n.id),
  ).length;
  return ownedInPrevTier >= TIER_REQUIREMENT[node.tier];
}

export function isUnlocked(unlocked: readonly string[], id: MasteryNodeId): boolean {
  return unlocked.includes(id);
}
