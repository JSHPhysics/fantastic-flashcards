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
import { LanguagePicker } from "./LanguagePicker";
import { labelForLanguage } from "../tts/languages";

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
  const [pronunciationLanguage, setPronunciationLanguage] = useState<
    string | undefined
  >(undefined);
  const [secondaryLanguage, setSecondaryLanguage] = useState<
    string | undefined
  >(undefined);
  const [langPickerSlot, setLangPickerSlot] = useState<
    "primary" | "secondary" | null
  >(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setSubject("");
      setColour(DECK_COLOURS[0]);
      setParentId(initialParentId);
      setPendingDepthCheck(false);
      setPronunciationLanguage(undefined);
      setSecondaryLanguage(undefined);
      setLangPickerSlot(null);
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
      pronunciationLanguage,
      secondaryLanguage,
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
        description="A deck is a group of cards on the same topic. You can nest decks inside others to keep things tidy."
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
          <Field
            label="Subject"
            hint="Optional. Shows as a small tag next to the deck name."
          >
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
          <Field
            label="Parent deck"
            hint="Leave blank to put this at the top level."
          >
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

          <LanguagePairSection
            primary={pronunciationLanguage}
            secondary={secondaryLanguage}
            onClearPrimary={() => {
              setPronunciationLanguage(undefined);
              // Clearing the primary clears the secondary too; the pair is
              // only meaningful when at least the primary is set.
              setSecondaryLanguage(undefined);
            }}
            onClearSecondary={() => setSecondaryLanguage(undefined)}
            onPickPrimary={() => setLangPickerSlot("primary")}
            onPickSecondary={() => setLangPickerSlot("secondary")}
          />
        </div>

        <LanguagePicker
          open={langPickerSlot === "primary"}
          onClose={() => setLangPickerSlot(null)}
          value={pronunciationLanguage}
          onChange={setPronunciationLanguage}
          title="Pronunciation language (front of cards)"
        />
        <LanguagePicker
          open={langPickerSlot === "secondary"}
          onClose={() => setLangPickerSlot(null)}
          value={secondaryLanguage}
          onChange={setSecondaryLanguage}
          title="Translation language (back of cards)"
        />
      </Dialog>

      <Dialog
        open={pendingDepthCheck}
        onClose={() => setPendingDepthCheck(false)}
        title="More than 4 levels deep"
        description="Decks tend to be easier to study when they're not nested too deep. Continue?"
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
          This will be the 5th level of sub-decks. You can still make it, but
          flatter trees are easier to navigate during study.
        </p>
      </Dialog>
    </>
  );
}

function LanguagePairSection({
  primary,
  secondary,
  onPickPrimary,
  onPickSecondary,
  onClearPrimary,
  onClearSecondary,
}: {
  primary: string | undefined;
  secondary: string | undefined;
  onPickPrimary: () => void;
  onPickSecondary: () => void;
  onClearPrimary: () => void;
  onClearSecondary: () => void;
}) {
  const hint = primary
    ? secondary
      ? `Each new card will have ${labelForLanguage(primary)} on the front and ${labelForLanguage(secondary)} on the back.`
      : `Speaker icons on this deck will read ${labelForLanguage(primary)}. Add a translation language if you want each card to have a different language on each side.`
    : "Optional. For language-learning decks: pick the language for the front of cards, and another for the back.";

  return (
    <div className="rounded-xl border border-ink-100 bg-cream/40 p-3 dark:border-dark-surface dark:bg-dark-bg/40">
      <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
        Language pair
      </p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <LangPill
          label="Primary"
          value={primary}
          onPick={onPickPrimary}
          onClear={onClearPrimary}
        />
        <LangPill
          label="Translation"
          value={secondary}
          disabled={!primary}
          onPick={onPickSecondary}
          onClear={onClearSecondary}
        />
      </div>
    </div>
  );
}

function LangPill({
  label,
  value,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  value: string | undefined;
  disabled?: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={onPick}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
          value
            ? "border-navy/30 bg-navy/10 text-navy dark:border-gold/30 dark:bg-gold/15 dark:text-gold"
            : "border-ink-300 bg-surface text-ink-700 hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-bg dark:text-ink-300"
        } disabled:opacity-40 disabled:hover:bg-surface`}
      >
        <span className="text-ink-500 dark:text-ink-300">{label}:</span>
        <span>{value ? labelForLanguage(value) : "Not set"}</span>
      </button>
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()} language`}
          onClick={onClear}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-again dark:hover:bg-dark-surface"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
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
