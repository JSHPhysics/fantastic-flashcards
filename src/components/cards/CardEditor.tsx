import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDecks,
  useDeck,
  useCard,
  type Card,
  type CardType,
  type Deck,
} from "../../db";
import {
  BasicForm,
  BasicPreview,
  basicDraftFromContent,
  basicDraftValid,
  defaultBasicDraft,
  type BasicDraft,
} from "./BasicForm";
import {
  ClozeForm,
  ClozePreview,
  clozeDraftFromContent,
  clozeDraftValid,
  defaultClozeDraft,
  type ClozeDraft,
} from "./ClozeForm";
import {
  McqForm,
  McqPreview,
  defaultMcqDraft,
  mcqDraftFromContent,
  mcqDraftValid,
  type McqDraft,
} from "./McqForm";
import {
  TypedForm,
  TypedPreview,
  defaultTypedDraft,
  typedDraftFromContent,
  typedDraftValid,
  parseAcceptedAnswers,
  type TypedDraft,
} from "./TypedForm";
import { TagsInput } from "../TagsInput";
import { FormField, inputClass } from "../FormField";
import { Button } from "../Button";
import { ConfirmDialog } from "../ConfirmDialog";
import { LockToggle } from "./LockToggle";
import {
  createBasicCard,
  createClozeCardSet,
  createMcqCard,
  createTypedCard,
  updateBasicCard,
  updateClozeCardSet,
  updateMcqCard,
  updateTypedCard,
} from "../../cards/service";

const TYPE_LABELS: Record<CardType, string> = {
  basic: "Basic",
  cloze: "Cloze",
  mcq: "MCQ",
  typed: "Typed",
  occlusion: "Occlusion",
  drawing: "Drawing",
};

// Session 4 ships the four text-based card types. The other two will hook in
// via the same tab strip in Sessions 8 (occlusion) and 9 (drawing).
const SESSION_4_TYPES: CardType[] = ["basic", "cloze", "mcq", "typed"];

interface CardEditorProps {
  cardId?: string;
  initialDeckId?: string;
  initialType?: CardType;
}

export function CardEditor({
  cardId,
  initialDeckId,
  initialType,
}: CardEditorProps) {
  const navigate = useNavigate();
  const decks = useDecks();
  const editingCard = useCard(cardId);
  const editing = Boolean(cardId);

  // pronunciationLanguage on the deck flows into every RichFieldEditor so the
  // language chip and speaker icon can render a sensible default per field.

  const [type, setType] = useState<CardType>(initialType ?? "basic");
  const [deckId, setDeckId] = useState<string | undefined>(initialDeckId);
  const [tags, setTags] = useState<string[]>([]);
  const activeDeck = useDeck(deckId);
  const deckLang = activeDeck?.pronunciationLanguage;
  const deckSecondary = activeDeck?.secondaryLanguage;

  // Materialise the effective language onto a RichField at save time so the
  // persisted card is self-contained. Without this, an auto-reverse sibling
  // that swaps front and back would inherit the wrong deck-default for each
  // side (front's text in back's language slot).
  const resolveField = (
    field: { text: string; imageHash?: string; audioHash?: string; language?: string },
    fallbackLang: string | undefined,
  ) => ({ ...field, language: field.language ?? fallbackLang });

  const [basic, setBasic] = useState<BasicDraft>(defaultBasicDraft());
  const [cloze, setCloze] = useState<ClozeDraft>(defaultClozeDraft());
  const [mcq, setMcq] = useState<McqDraft>(defaultMcqDraft());
  const [typed, setTyped] = useState<TypedDraft>(defaultTypedDraft());

  const [pendingType, setPendingType] = useState<CardType | null>(null);
  const [clozeFocusedNumber, setClozeFocusedNumber] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Lock state for bulk authoring. Locked fields keep their values across
  // consecutive "Save and add another" commits; unlocked fields reset. State
  // lives in this component instance so navigating away wipes it (Playbook
  // section 8 "transient store, clears on navigation away from the editor").
  const [locks, setLocks] = useState<{
    deck: boolean;
    type: boolean;
    tags: boolean;
  }>({ deck: false, type: false, tags: false });
  // Auto-lock tags once when they first become non-empty, unless the user has
  // already touched the tag lock manually.
  const [tagsLockTouched, setTagsLockTouched] = useState(false);

  // Load existing card into the right sub-draft. Runs only when editing.
  useEffect(() => {
    if (!editing || !editingCard) return;
    setDeckId(editingCard.deckId);
    setTags(editingCard.tags);
    setType(editingCard.type);
    switch (editingCard.content.type) {
      case "basic":
        setBasic(basicDraftFromContent(editingCard.content));
        break;
      case "cloze":
        setCloze(clozeDraftFromContent(editingCard.content));
        break;
      case "mcq":
        setMcq(mcqDraftFromContent(editingCard.content));
        break;
      case "typed":
        setTyped(typedDraftFromContent(editingCard.content));
        break;
    }
  }, [editing, editingCard]);

  const draftDirtyForType = (t: CardType): boolean => {
    switch (t) {
      case "basic":
        return basic.front.text.trim() !== "" || basic.back.text.trim() !== "";
      case "cloze":
        return cloze.text.trim() !== "";
      case "mcq":
        return (
          mcq.question.text.trim() !== "" ||
          mcq.options.some((o) => o.text.trim() !== "" || o.correct)
        );
      case "typed":
        return (
          typed.prompt.text.trim() !== "" ||
          typed.acceptedAnswersRaw.trim() !== ""
        );
      default:
        return false;
    }
  };

  const isDraftValid = (): boolean => {
    if (!deckId) return false;
    switch (type) {
      case "basic":
        return basicDraftValid(basic);
      case "cloze":
        return clozeDraftValid(cloze);
      case "mcq":
        return mcqDraftValid(mcq);
      case "typed":
        return typedDraftValid(typed);
      default:
        return false;
    }
  };

  const handleTypeTab = (next: CardType) => {
    if (next === type) return;
    if (editing) {
      // Editing an existing card cannot change type cleanly (content shapes
      // diverge). Block the switch with an inline note instead of warning.
      return;
    }
    if (draftDirtyForType(type) && next !== type) {
      setPendingType(next);
      return;
    }
    setType(next);
  };

  const performTypeSwitch = (next: CardType) => {
    switch (type) {
      case "basic":
        setBasic(defaultBasicDraft());
        break;
      case "cloze":
        setCloze(defaultClozeDraft());
        break;
      case "mcq":
        setMcq(defaultMcqDraft());
        break;
      case "typed":
        setTyped(defaultTypedDraft());
        break;
    }
    setType(next);
  };

  const save = async (
    options: { andAddAnother?: boolean } = {},
  ): Promise<void> => {
    if (!deckId || !isDraftValid() || saving) return;
    setSaving(true);
    try {
      const frontResolved = resolveField(basic.front, deckLang);
      const backResolved = resolveField(basic.back, deckSecondary ?? deckLang);

      if (editing && cardId) {
        switch (type) {
          case "basic":
            await updateBasicCard(cardId, {
              deckId,
              tags,
              front: frontResolved,
              back: backResolved,
              autoReverse: basic.autoReverse,
            });
            break;
          case "cloze":
            await updateClozeCardSet(cardId, { deckId, tags, text: cloze.text });
            break;
          case "mcq":
            await updateMcqCard(cardId, {
              deckId,
              tags,
              question: resolveField(mcq.question, deckLang),
              options: mcq.options,
              shuffleOptions: mcq.shuffleOptions,
            });
            break;
          case "typed":
            await updateTypedCard(cardId, {
              deckId,
              tags,
              prompt: resolveField(typed.prompt, deckLang),
              acceptedAnswers: parseAcceptedAnswers(typed.acceptedAnswersRaw),
              caseSensitive: typed.caseSensitive,
              ignorePunctuation: typed.ignorePunctuation,
            });
            break;
        }
      } else {
        switch (type) {
          case "basic":
            await createBasicCard({
              deckId,
              tags,
              front: frontResolved,
              back: backResolved,
              autoReverse: basic.autoReverse,
            });
            break;
          case "cloze":
            await createClozeCardSet({ deckId, tags, text: cloze.text });
            break;
          case "mcq":
            await createMcqCard({
              deckId,
              tags,
              question: resolveField(mcq.question, deckLang),
              options: mcq.options,
              shuffleOptions: mcq.shuffleOptions,
            });
            break;
          case "typed":
            await createTypedCard({
              deckId,
              tags,
              prompt: resolveField(typed.prompt, deckLang),
              acceptedAnswers: parseAcceptedAnswers(typed.acceptedAnswersRaw),
              caseSensitive: typed.caseSensitive,
              ignorePunctuation: typed.ignorePunctuation,
            });
            break;
        }
      }

      if (options.andAddAnother) {
        // Always reset the content draft for the active type. Common fields
        // (deck, type, tags) reset only if their lock is OFF.
        switch (type) {
          case "basic":
            setBasic(defaultBasicDraft());
            break;
          case "cloze":
            setCloze(defaultClozeDraft());
            break;
          case "mcq":
            setMcq(defaultMcqDraft());
            break;
          case "typed":
            setTyped(defaultTypedDraft());
            break;
        }
        if (!locks.deck) setDeckId(initialDeckId);
        if (!locks.type) setType(initialType ?? "basic");
        if (!locks.tags) {
          setTags([]);
          // After a "fresh" tags reset we let the auto-lock kick in again.
          setTagsLockTouched(false);
        }
        return;
      }

      if (editing) navigate(`/decks/${deckId}`);
      else navigate(`/decks/${deckId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <header className="sticky top-14 -mx-4 -mt-4 z-10 border-b border-ink-100 bg-cream/95 px-4 py-3 backdrop-blur dark:border-dark-surface dark:bg-dark-bg/95 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-navy dark:text-gold">
            {editing ? "Edit card" : "New card"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            {!editing && (
              <Button
                variant="secondary"
                disabled={!isDraftValid() || saving}
                onClick={() => save({ andAddAnother: true })}
              >
                Save and add another
              </Button>
            )}
            <Button
              disabled={!isDraftValid() || saving}
              onClick={() => save()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      {!editing && (
        <FrozenPill
          locks={locks}
          onUnlockAll={() =>
            setLocks({ deck: false, type: false, tags: false })
          }
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TypeTabs
          type={type}
          editing={editing}
          onChange={handleTypeTab}
        />
        {!editing && (
          <LockToggle
            locked={locks.type}
            onChange={(v) => setLocks((s) => ({ ...s, type: v }))}
            fieldLabel="Card type"
          />
        )}
      </div>

      <CommonFields
        decks={decks ?? []}
        deckId={deckId}
        onDeckIdChange={setDeckId}
        tags={tags}
        onTagsChange={(next) => {
          setTags(next);
          if (
            !tagsLockTouched &&
            next.length > 0 &&
            !locks.tags
          ) {
            setLocks((s) => ({ ...s, tags: true }));
          }
        }}
        editing={editing}
        locks={locks}
        onLockChange={(field, v) => {
          if (field === "tags") setTagsLockTouched(true);
          setLocks((s) => ({ ...s, [field]: v }));
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Editor
          </h2>
          {type === "basic" && (
            <BasicForm
              draft={basic}
              onChange={setBasic}
              lockAutoReverseOff={
                editing && editingCard?.generatedFromCardId !== undefined
              }
              deckPronunciationLanguage={deckLang}
              deckSecondaryLanguage={deckSecondary}
            />
          )}
          {type === "cloze" && (
            <ClozeForm draft={cloze} onChange={setCloze} />
          )}
          {type === "mcq" && (
            <McqForm
              draft={mcq}
              onChange={setMcq}
              deckPronunciationLanguage={deckLang}
            />
          )}
          {type === "typed" && (
            <TypedForm
              draft={typed}
              onChange={setTyped}
              deckPronunciationLanguage={deckLang}
            />
          )}
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Preview
          </h2>
          {type === "basic" && <BasicPreview draft={basic} />}
          {type === "cloze" && (
            <ClozePreview
              draft={cloze}
              focused={clozeFocusedNumber}
              onFocusChange={setClozeFocusedNumber}
            />
          )}
          {type === "mcq" && <McqPreview draft={mcq} />}
          {type === "typed" && <TypedPreview draft={typed} />}
        </section>
      </div>

      <ConfirmDialog
        open={pendingType !== null}
        onClose={() => setPendingType(null)}
        onConfirm={() => {
          if (pendingType) performTypeSwitch(pendingType);
        }}
        title={`Switch to ${pendingType ? TYPE_LABELS[pendingType] : ""}?`}
        description={`This discards your current ${TYPE_LABELS[type]} draft.`}
        confirmLabel="Switch"
        destructive
      />
    </div>
  );
}

function TypeTabs({
  type,
  editing,
  onChange,
}: {
  type: CardType;
  editing: boolean;
  onChange: (t: CardType) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
      {SESSION_4_TYPES.map((t) => {
        const active = t === type;
        const disabled = editing && t !== type;
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(t)}
            className={`tap-target whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
              active
                ? "bg-navy text-cream"
                : "bg-ink-100 text-ink-700 hover:bg-ink-100/70 dark:bg-dark-surface dark:text-ink-300"
            } disabled:opacity-50 disabled:hover:bg-ink-100`}
          >
            {TYPE_LABELS[t]}
          </button>
        );
      })}
      <span
        aria-hidden
        className="self-center pl-2 text-xs text-ink-500 dark:text-ink-300"
      >
        Occlusion & Drawing arrive in Sessions 8-9.
      </span>
    </div>
  );
}

function CommonFields({
  decks,
  deckId,
  onDeckIdChange,
  tags,
  onTagsChange,
  editing,
  locks,
  onLockChange,
}: {
  decks: Deck[];
  deckId: string | undefined;
  onDeckIdChange: (id: string) => void;
  tags: string[];
  onTagsChange: (next: string[]) => void;
  editing: boolean;
  locks: { deck: boolean; type: boolean; tags: boolean };
  onLockChange: (field: "deck" | "type" | "tags", next: boolean) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label={
          <span className="flex items-center gap-2">
            Deck
            {!editing && (
              <LockToggle
                locked={locks.deck}
                onChange={(v) => onLockChange("deck", v)}
                fieldLabel="Deck"
              />
            )}
          </span>
        }
        htmlFor="card-deck"
      >
        <select
          id="card-deck"
          value={deckId ?? ""}
          onChange={(e) => onDeckIdChange(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select a deck
          </option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label={
          <span className="flex items-center gap-2">
            Tags
            {!editing && (
              <LockToggle
                locked={locks.tags}
                onChange={(v) => onLockChange("tags", v)}
                fieldLabel="Tags"
              />
            )}
          </span>
        }
        hint="Lowercase, kebab-case suggested."
      >
        <TagsInput value={tags} onChange={onTagsChange} />
      </FormField>
    </div>
  );
}

function FrozenPill({
  locks,
  onUnlockAll,
}: {
  locks: { deck: boolean; type: boolean; tags: boolean };
  onUnlockAll: () => void;
}) {
  const lockedNames: string[] = [];
  if (locks.deck) lockedNames.push("deck");
  if (locks.type) lockedNames.push("type");
  if (locks.tags) lockedNames.push("tags");
  if (lockedNames.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-gold/15 px-3 py-1.5 text-xs">
      <span className="font-medium text-navy dark:text-gold">
        Frozen: {lockedNames.join(", ")}
      </span>
      <button
        type="button"
        onClick={onUnlockAll}
        className="rounded-full px-2 py-0.5 text-navy hover:bg-gold/25 dark:text-gold"
      >
        Unlock all
      </button>
    </div>
  );
}

// Helper for tests / external consumers
export function cardIsBasicReverseSibling(card: Card | undefined): boolean {
  return Boolean(card?.generatedFromCardId);
}
