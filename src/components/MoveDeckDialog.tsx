import { useMemo, useState } from "react";
import { moveDeck, useDecks } from "../db";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { buildDeckTree, flattenTree, isAncestor } from "../decks/tree";

interface MoveDeckDialogProps {
  open: boolean;
  onClose: () => void;
  movingDeckId: string;
}

export function MoveDeckDialog({
  open,
  onClose,
  movingDeckId,
}: MoveDeckDialogProps) {
  const decks = useDecks();
  const [chosenParent, setChosenParent] = useState<string | "__root__">(
    "__root__",
  );

  const candidates = useMemo(() => {
    if (!decks) return [];
    // Exclude the deck itself and any of its descendants.
    const forbidden = new Set(
      decks
        .filter((d) => isAncestor(decks, movingDeckId, d.id))
        .map((d) => d.id),
    );
    const tree = buildDeckTree(decks.filter((d) => !forbidden.has(d.id)));
    return flattenTree(tree);
  }, [decks, movingDeckId]);

  const submit = async () => {
    await moveDeck(
      movingDeckId,
      chosenParent === "__root__" ? undefined : chosenParent,
    );
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Move deck"
      description="Choose a new parent. The deck and its sub-decks come with it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Move</Button>
        </>
      }
    >
      <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-100 dark:border-dark-surface">
        <RadioRow
          name="parent"
          value="__root__"
          checked={chosenParent === "__root__"}
          onChange={() => setChosenParent("__root__")}
          label="(root)"
          depth={0}
        />
        {candidates.map((node) => (
          <RadioRow
            key={node.deck.id}
            name="parent"
            value={node.deck.id}
            checked={chosenParent === node.deck.id}
            onChange={() => setChosenParent(node.deck.id)}
            label={node.deck.name}
            depth={node.depth}
          />
        ))}
      </div>
    </Dialog>
  );
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  depth,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  depth: number;
}) {
  return (
    <label
      className="tap-target flex w-full cursor-pointer items-center gap-3 border-b border-ink-100 px-3 py-2 last:border-b-0 hover:bg-ink-100/50 dark:border-dark-surface dark:hover:bg-dark-surface/40"
      style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4"
      />
      <span className="text-sm text-ink-900 dark:text-dark-ink">{label}</span>
    </label>
  );
}
