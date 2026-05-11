import { useEffect, useState } from "react";
import { speak } from "../tts/speak";
import { hasSpeechSynthesis, pickVoice, subscribeVoiceChange } from "../tts/voices";
import { labelForLanguage } from "../tts/languages";

interface SpeakerButtonProps {
  text: string;
  lang: string | undefined;
  size?: "sm" | "md";
}

// Renders nothing when there's no language or the browser has no TTS - keeps
// the editor and review surfaces uncluttered for cards that aren't language-
// oriented.
//
// The tooltip surfaces the actual voice that will play, so authors can tell
// at a glance whether an Enhanced voice is in use or if the browser is about
// to fall back to a robotic compact voice / English default.
export function SpeakerButton({ text, lang, size = "sm" }: SpeakerButtonProps) {
  const matched = useMatchedVoice(lang);
  if (!lang || !hasSpeechSynthesis()) return null;
  const dim = !text.trim();
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  const langLabel = labelForLanguage(lang);
  const title = matched
    ? `Pronounce in ${langLabel} (${matched.name})`
    : `No ${langLabel} voice installed - speaking with the browser default`;

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={dim}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(text, lang);
      }}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-navy/10 disabled:opacity-30 dark:hover:bg-gold/10 ${
        matched
          ? "text-navy dark:text-gold"
          : "text-ink-500 dark:text-ink-300"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
        <path
          d="M16 8a5 5 0 0 1 0 8M18.5 5a8 8 0 0 1 0 14"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

// Re-derives the matched voice when either the language changes or the
// browser's voice list updates (iPad Enhanced voices stream in async).
function useMatchedVoice(lang: string | undefined): SpeechSynthesisVoice | undefined {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>(() =>
    lang ? pickVoice(lang) : undefined,
  );
  useEffect(() => {
    if (!lang) {
      setVoice(undefined);
      return;
    }
    setVoice(pickVoice(lang));
    return subscribeVoiceChange(() => setVoice(pickVoice(lang)));
  }, [lang]);
  return voice;
}
