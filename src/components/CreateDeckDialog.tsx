import { useEffect, useState } from "react";
import {
  DECK_COLOURS,
  createDeck,
  getDeckDepth,
  useDecks,
  type Deck,
} from "../db";
import { Dialog } from "./Dialog";
import { Button } from "./Button";

interface CreateDeckDialogProps {
  open: boolean;
  onClose: () => void;
  initialParentId?: string;
  onCreated?: (deck: Deck) => void;
}

export function CreateDeckDialog({
  open,
  onClose,
  initialParentId,
  onCreated,
}: CreateDeckDialogProps) {
  const decks = useDecks();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [colour, setColour] = useState<string>(DECK_COLOURS[0]);
  const [parentId, setParentId] = useState<string | undefined>(initialParentId);
  const [pendingDepthCheck, setPendingDepthCheck] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSubject("");
      setColour(DECK_COLOURS[0]);
      setParentId(initialParentId);
      setPendingDepthCheck(false);
    }
  }, [open, initialParentId]);

  const submit = async (skipDepthCheck = false) => {
    if (!name.trim()) return;
    // Depth warning fires when the new deck would sit at level >4.
    if (!skipDepthCheck && parentId) {
      const parentDepth = await getDeckDepth(parentId);
      if (parentDepth + 1 > 4) {
        setPendingDepthCheck(true);
        return;
      }
    }
    const created = await createDeck({
      name: name.trim(),
      description: description.trim() || undefined,
      subject: subject.trim() || undefined,
      colour,
      parentId,
    });
    onCreated?.(created);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open && !pendingDepthCheck}
        onClose={onClose}
        title="Create deck"
        description="Decks group related cards. Nest them with a parent."
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => submit(false)} disabled={!name.trim()}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. French vocabulary"
              className={inputClass}
            />
          </Field>
          <Field label="Subject" hint="Optional. Used as a chip on the row.">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. French"
              className={inputClass}
            />
          </Field>
          <Field label="Description" hint="Optional.">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-2">
              {DECK_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  aria-pressed={colour === c}
                  onClick={() => setColour(c)}
                  className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition-all ${
                    colour === c
                      ? "ring-navy"
                      : "ring-transparent hover:ring-ink-300"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
          <Field label="Parent deck" hint="Leave blank for a root deck.">
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || undefined)}
              className={inputClass}
            >
              <option value="">(root)</option>
              {(decks ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={pendingDepthCheck}
        onClose={() => setPendingDepthCheck(false)}
        title="Going deeper than 4 levels"
        description="Most decks work best at 3 or 4 levels of nesting. Continue anyway?"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setPendingDepthCheck(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => submit(true)}>Continue</Button>
          </>
        }
      >
        <p className="text-sm text-ink-700 dark:text-ink-300">
          You're about to create a 5th level of nesting. The app won't stop you,
          but flat structures are easier to study and review.
        </p>
      </Dialog>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink-900 dark:text-dark-ink">
        {label}
      </span>
      {hint && (
        <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-300">
          {hint}
        </span>
      )}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-ink-300 bg-surface px-3 py-2 text-base text-ink-900 placeholder:text-ink-500 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/30 dark:border-dark-surface dark:bg-dark-bg dark:text-dark-ink";
