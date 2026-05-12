import { useEffect, useState } from "react";
import type { BasicContent, Rating, RichField } from "../../db";
import { useProfile } from "../../db";
import { RatingButtons } from "./RatingButtons";
import { Button } from "../Button";
import { RichFieldRender } from "../media/RichFieldPreview";
import { SpeakerButton } from "../SpeakerButton";
import { speak, cancelSpeech } from "../../tts/speak";

interface BasicReviewProps {
  content: BasicContent;
  onRate: (rating: Rating) => void;
  // BCP 47 of the student's native language for this deck. When set, auto-
  // speak never reads this language - it reads the *other* side of the card
  // instead, so the student always hears the foreign-language word out loud
  // whichever direction the card is facing.
  baseLanguage?: string;
}

export function BasicReview({ content, onRate, baseLanguage }: BasicReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const profile = useProfile();
  const online = profile?.settings.useOnlineVoices ?? false;
  const autoOnShow = profile?.settings.ttsAutoplayOnShow ?? false;
  const autoOnReveal = profile?.settings.ttsAutoplayOnReveal ?? false;

  // Pick which RichField to read for each trigger. When baseLanguage is set
  // and the natural target's language matches it, swap to the opposite side
  // so the foreign-language word still gets spoken.
  const showTarget = pickSpeakTarget(content.front, content.back, baseLanguage);
  const revealTarget = pickSpeakTarget(content.back, content.front, baseLanguage);

  // Speak the appropriate side when the card appears, if the user opted in.
  useEffect(() => {
    if (
      autoOnShow &&
      showTarget &&
      showTarget.language &&
      showTarget.text.trim()
    ) {
      speak(showTarget.text, showTarget.language, { online });
    }
    return () => {
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTarget?.text, showTarget?.language]);

  // Speak the appropriate side when the answer is revealed.
  useEffect(() => {
    if (!revealed) return;
    if (
      autoOnReveal &&
      revealTarget &&
      revealTarget.language &&
      revealTarget.text.trim()
    ) {
      speak(revealTarget.text, revealTarget.language, { online });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  return (
    <div className="space-y-4">
      <CardFace
        label="Front"
        field={content.front}
        showSpeaker={!autoOnShow}
      />
      {revealed ? (
        <>
          <CardFace
            label="Back"
            field={content.back}
            showSpeaker={!autoOnReveal}
          />
          <RatingButtons onRate={onRate} />
        </>
      ) : (
        <div className="flex justify-center">
          <Button onClick={() => setRevealed(true)}>Show answer</Button>
        </div>
      )}
    </div>
  );
}

// Choose which field auto-speak should read. Default is the "natural" side
// for the trigger (front on show, back on reveal). When the deck has a
// baseLanguage and that side's language matches it, redirect to the other
// side so the foreign language gets spoken instead. If the alternate side
// also matches the base language (or has no language at all), fall back to
// the natural side rather than going silent.
function pickSpeakTarget(
  natural: RichField,
  alternate: RichField,
  baseLanguage: string | undefined,
): RichField {
  if (!baseLanguage) return natural;
  if (natural.language !== baseLanguage) return natural;
  if (alternate.language && alternate.language !== baseLanguage) {
    return alternate;
  }
  return natural;
}

function CardFace({
  label,
  field,
  showSpeaker,
}: {
  label: string;
  field: RichField;
  showSpeaker: boolean;
}) {
  return (
    <div className="card-surface p-6">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          {label}
        </p>
        {showSpeaker && field.language && (
          <SpeakerButton text={field.text} lang={field.language} />
        )}
      </div>
      <div className="mt-2 text-card-body">
        <RichFieldRender field={field} />
      </div>
    </div>
  );
}
