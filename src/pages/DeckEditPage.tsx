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
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deck) return;
    setName(deck.name);
    setDescription(deck.description ?? "");
    setSubject(deck.subject ?? "");
    setColour(deck.colour);
    setPronunciationLanguage(deck.pronunciationLanguage);
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
        <FormField label="Subject" hint="Optional. Used as a chip on the row.">
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
        <FormField
          label="Pronunciation language"
          hint="Speaker icons appear on fields with a language. The deck default is used unless a field overrides it."
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLangPickerOpen(true)}
              className="tap-target inline-flex items-center gap-2 rounded-xl border border-ink-300 bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-bg dark:text-ink-300"
            >
              {pronunciationLanguage
                ? `${labelForLanguage(pronunciationLanguage)} - ${pronunciationLanguage}`
                : "Choose language"}
            </button>
            {pronunciationLanguage && (
              <button
                type="button"
                onClick={() => setPronunciationLanguage(undefined)}
                className="text-xs text-ink-500 hover:underline dark:text-ink-300"
              >
                Clear
              </button>
            )}
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
        open={langPickerOpen}
        onClose={() => setLangPickerOpen(false)}
        value={pronunciationLanguage}
        onChange={setPronunciationLanguage}
        title="Deck pronunciation language"
      />
    </section>
  );
}
