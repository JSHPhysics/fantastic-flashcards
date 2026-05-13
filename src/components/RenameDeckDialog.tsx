import { useEffect, useState } from "react";
import { updateDeck, type Deck } from "../db";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface RenameDeckDialogProps {
  open: boolean;
  onClose: () => void;
  deck: Deck;
}

export function RenameDeckDialog({
  open,
  onClose,
  deck,
}: RenameDeckDialogProps) {
  const [name, setName] = useState(deck.name);

  useEffect(() => {
    if (open) setName(deck.name);
  }, [open, deck.name]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === deck.name) {
      onClose();
      return;
    }
    await updateDeck(deck.id, { name: trimmed });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Rename deck"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            Save
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </Dialog>
  );
}
