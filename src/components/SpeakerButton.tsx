import { speak } from "../tts/speak";
import { hasSpeechSynthesis } from "../tts/useVoices";
import { labelForLanguage } from "../tts/languages";

interface SpeakerButtonProps {
  text: string;
  lang: string | undefined;
  size?: "sm" | "md";
}

// Renders nothing when there's no language or the browser has no TTS — keeps
// the editor and review surfaces uncluttered for cards that aren't language-
// oriented.
export function SpeakerButton({ text, lang, size = "sm" }: SpeakerButtonProps) {
  if (!lang || !hasSpeechSynthesis()) return null;
  const dim = !text.trim();
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <button
      type="button"
      aria-label={`Pronounce in ${labelForLanguage(lang)}`}
      disabled={dim}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(text, lang);
      }}
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/10 disabled:opacity-30 dark:text-gold dark:hover:bg-gold/10`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M4 9v6h4l5 4V5L8 9H4Z"
          fill="currentColor"
        />
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
