import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useDecks,
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

  const [type, setType] = useState<CardType>(initialType ?? "basic");
  const [deckId, setDeckId] = useState<string | undefined>(initialDeckId);
  const [tags, setTags] = useState<string[]>([]);

  const [basic, setBasic] = useState<BasicDraft>(defaultBasicDraft());
  const [cloze, setCloze] = useState<ClozeDraft>(defaultClozeDraft());
  const [mcq, setMcq] = useState<McqDraft>(defaultMcqDraft());
  const [typed, setTyped] = useState<TypedDraft>(defaultTypedDraft());

  const [pendingType, setPendingType] = useState<CardType | null>(null);
  const [clozeFocusedNumber, setClozeFocusedNumber] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);

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
          mcq.questionText.trim() !== "" ||
          mcq.options.some((o) => o.text.trim() !== "" || o.correct)
        );
      case "typed":
        return (
          typed.promptText.trim() !== "" || typed.acceptedAnswersRaw.trim() !== ""
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
      if (editing && cardId) {
        switch (type) {
          case "basic":
            await updateBasicCard(cardId, {
              deckId,
              tags,
              front: basic.front,
              back: basic.back,
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
              question: { text: mcq.questionText },
              options: mcq.options,
              shuffleOptions: mcq.shuffleOptions,
            });
            break;
          case "typed":
            await updateTypedCard(cardId, {
              deckId,
              tags,
              prompt: { text: typed.promptText },
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
              front: basic.front,
              back: basic.back,
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
              question: { text: mcq.questionText },
              options: mcq.options,
              shuffleOptions: mcq.shuffleOptions,
            });
            break;
          case "typed":
            await createTypedCard({
              deckId,
              tags,
              prompt: { text: typed.promptText },
              acceptedAnswers: parseAcceptedAnswers(typed.acceptedAnswersRaw),
              caseSensitive: typed.caseSensitive,
              ignorePunctuation: typed.ignorePunctuation,
            });
            break;
        }
      }

      if (options.andAddAnother) {
        // Reset the active draft; Session 5 will respect frozen fields here.
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
        // Stay on the editor.
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

      <TypeTabs
        type={type}
        editing={editing}
        onChange={handleTypeTab}
      />

      <CommonFields
        decks={decks ?? []}
        deckId={deckId}
        onDeckIdChange={setDeckId}
        tags={tags}
        onTagsChange={setTags}
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
            />
          )}
          {type === "cloze" && (
            <ClozeForm draft={cloze} onChange={setCloze} />
          )}
          {type === "mcq" && <McqForm draft={mcq} onChange={setMcq} />}
          {type === "typed" && <TypedForm draft={typed} onChange={setTyped} />}
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
}: {
  decks: Deck[];
  deckId: string | undefined;
  onDeckIdChange: (id: string) => void;
  tags: string[];
  onTagsChange: (next: string[]) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Deck" htmlFor="card-deck">
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
      <FormField label="Tags" hint="Lowercase, kebab-case suggested.">
        <TagsInput value={tags} onChange={onTagsChange} />
      </FormField>
    </div>
  );
}

// Helper for tests / external consumers
export function cardIsBasicReverseSibling(card: Card | undefined): boolean {
  return Boolean(card?.generatedFromCardId);
}
