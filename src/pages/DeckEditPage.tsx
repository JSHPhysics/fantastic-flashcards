import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DECK_COLOURS, updateDeck, useDeck } from "../db";
import { Button } from "../components/Button";
import { FormField, inputClass } from "../components/FormField";
import { LanguagePicker } from "../components/LanguagePicker";
import { labelForLanguage } from "../tts/languages";

export function DeckEditPage() {
  const { id } = useParams();
  const deck = useDeck(id);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [colour, setColour] = useState<string>(DECK_COLOURS[0]);
  const [pronunciationLanguage, setPronunciationLanguage] = useState<
    string | undefined
  >(undefined);
  const [secondaryLanguage, setSecondaryLanguage] = useState<
    string | undefined
  >(undefined);
  const [langPickerSlot, setLangPickerSlot] = useState<
    "primary" | "secondary" | null
  >(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deck) return;
    setName(deck.name);
    setDescription(deck.description ?? "");
    setSubject(deck.subject ?? "");
    setColour(deck.colour);
    setPronunciationLanguage(deck.pronunciationLanguage);
    setSecondaryLanguage(deck.secondaryLanguage);
  }, [deck]);

  if (!deck || !id) {
    return (
      <div className="mt-8 text-center">
        <p className="text-base text-ink-700 dark:text-ink-300">Deck not found.</p>
        <Link to="/" className="mt-3 inline-block text-navy underline dark:text-gold">
          Back to home
        </Link>
      </div>
    );
  }

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await updateDeck(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        subject: subject.trim() || undefined,
        colour,
        pronunciationLanguage,
        secondaryLanguage,
      });
      navigate(`/decks/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6">
      <header>
        <Link
          to={`/decks/${id}`}
          className="text-sm text-ink-500 hover:underline dark:text-ink-300"
        >
          {"<-"} Back to deck
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-navy dark:text-gold">
          Edit deck
        </h1>
      </header>

      <div className="space-y-4">
        <FormField label="Name" htmlFor="deck-name">
          <input
            id="deck-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField
          label="Subject"
          hint="Optional. Shows as a small tag next to the deck name."
        >
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Description" hint="Optional.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y min-h-[5rem]`}
          />
        </FormField>
        <FormField label="Colour">
          <div className="flex flex-wrap gap-2">
            {DECK_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={colour === c}
                onClick={() => setColour(c)}
                className={`h-9 w-9 rounded-full ring-2 ring-offset-2 transition-all ${
                  colour === c ? "ring-navy" : "ring-transparent hover:ring-ink-300"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </FormField>
        <FormField label="Language pair (optional)">
          <div className="space-y-3">
            <p className="text-xs text-ink-500 dark:text-ink-300">
              {pronunciationLanguage
                ? secondaryLanguage
                  ? `New cards in this deck will have ${labelForLanguage(pronunciationLanguage)} on the front and ${labelForLanguage(secondaryLanguage)} on the back.`
                  : `Speaker icons in this deck will read ${labelForLanguage(pronunciationLanguage)}. Add a translation language if you want each card to have a different language on each side.`
                : "For language-learning decks: pick the language for the front of cards, and another for the back."}
            </p>
            <div className="flex flex-wrap gap-2">
              <LangPill
                label="Primary"
                value={pronunciationLanguage}
                onPick={() => setLangPickerSlot("primary")}
                onClear={() => {
                  setPronunciationLanguage(undefined);
                  setSecondaryLanguage(undefined);
                }}
              />
              <LangPill
                label="Translation"
                value={secondaryLanguage}
                disabled={!pronunciationLanguage}
                onPick={() => setLangPickerSlot("secondary")}
                onClear={() => setSecondaryLanguage(undefined)}
              />
            </div>
          </div>
        </FormField>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!name.trim() || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="ghost" onClick={() => navigate(`/decks/${id}`)}>
          Cancel
        </Button>
      </div>

      <LanguagePicker
        open={langPickerSlot === "primary"}
        onClose={() => setLangPickerSlot(null)}
        value={pronunciationLanguage}
        onChange={setPronunciationLanguage}
        title="Primary language (front of cards)"
      />
      <LanguagePicker
        open={langPickerSlot === "secondary"}
        onClose={() => setLangPickerSlot(null)}
        value={secondaryLanguage}
        onChange={setSecondaryLanguage}
        title="Translation language (back of cards)"
      />
    </section>
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
        className={`tap-target inline-flex items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors ${
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
