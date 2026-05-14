// Mastery Tree screen (Survivors-Spec §2.9). Three tiers, locked progressively.
// Spend Insight to permanently unlock a node.

import { useState } from "react";
import { MASTERY_NODES, canPurchase, type MasteryNode } from "../mastery/tree";
import { purchaseNode, useMastery } from "../persistence/survivorStore";
import { Button } from "../../../components/Button";

interface MasteryTreeScreenProps {
  onClose: () => void;
}

const TIER_LABEL = ["", "Tier 1 — start here", "Tier 2 — needs 2 from Tier 1", "Tier 3 — needs 2 from Tier 2"];

export function MasteryTreeScreen({ onClose }: MasteryTreeScreenProps) {
  const mastery = useMastery();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const buy = async (node: MasteryNode) => {
    if (busy) return;
    setBusy(node.id);
    const r = await purchaseNode(node.id);
    setBusy(null);
    if (!r.ok) setMessage(r.reason ?? "Couldn't unlock that node.");
    else setMessage(`Unlocked ${node.name}.`);
  };

  const balance = mastery?.insightBalance ?? 0;
  const unlocked = mastery?.unlockedNodes ?? [];
  const lifetime = mastery?.insightLifetime ?? 0;

  return (
    <section className="space-y-5">
      <header>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-ink-500 hover:underline dark:text-ink-300"
        >
          ← Back
        </button>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy dark:text-gold sm:text-3xl">
          Mastery Tree
        </h1>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
          Permanent unlocks for Flashcard Survivors. Insight earned this
          lifetime: <span className="font-semibold text-ink-900 dark:text-dark-ink">{lifetime}</span>.
        </p>
      </header>

      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Insight balance
          </p>
          <p className="text-2xl font-semibold text-ink-900 dark:text-dark-ink">{balance}</p>
        </div>
        {message && (
          <p className="text-sm text-good">{message}</p>
        )}
      </div>

      {[1, 2, 3].map((tier) => {
        const tierNodes = MASTERY_NODES.filter((n) => n.tier === tier);
        return (
          <section key={tier} className="space-y-2">
            <h2 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
              {TIER_LABEL[tier]}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {tierNodes.map((node) => {
                const owned = unlocked.includes(node.id);
                const eligible = canPurchase(node, unlocked, balance);
                return (
                  <li
                    key={node.id}
                    className={`rounded-2xl border-2 p-3 ${
                      owned
                        ? "border-good bg-good/10"
                        : eligible
                          ? "border-navy/40 bg-navy/5 dark:border-gold/40 dark:bg-gold/10"
                          : "border-ink-200 opacity-70 dark:border-dark-surface"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-ink-900 dark:text-dark-ink">
                          {node.name}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-300">
                          {node.description}
                        </p>
                      </div>
                      <span className="text-xs text-ink-500 dark:text-ink-300">{node.cost}</span>
                    </div>
                    <div className="mt-2">
                      {owned ? (
                        <span className="text-xs font-semibold text-good">Owned</span>
                      ) : (
                        <Button
                          size="sm"
                          variant={eligible ? "primary" : "ghost"}
                          onClick={() => void buy(node)}
                          disabled={!eligible || busy !== null}
                        >
                          {busy === node.id
                            ? "..."
                            : eligible
                              ? "Unlock"
                              : balance < node.cost
                                ? `${node.cost - balance} short`
                                : "Locked"}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
