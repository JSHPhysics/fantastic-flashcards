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
}

export function BasicReview({ content, onRate }: BasicReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const profile = useProfile();
  const online = profile?.settings.useOnlineVoices ?? false;
  const autoOnShow = profile?.settings.ttsAutoplayOnShow ?? false;
  const autoOnReveal = profile?.settings.ttsAutoplayOnReveal ?? false;

  // Speak the front when it appears, if the user opted in.
  useEffect(() => {
    if (autoOnShow && content.front.language && content.front.text.trim()) {
      speak(content.front.text, content.front.language, { online });
    }
    return () => {
      cancelSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.front.text, content.front.language]);

  // Speak the back when the answer is revealed.
  useEffect(() => {
    if (!revealed) return;
    if (autoOnReveal && content.back.language && content.back.text.trim()) {
      speak(content.back.text, content.back.language, { online });
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
