// Online pronunciation via Google's translate-TTS endpoint. Not an officially
// supported API but stable for years and used by many language tools. The
// audio is loaded with a plain HTMLAudioElement, which bypasses CORS for
// cross-origin media (the browser plays it directly, no JS-side fetch).
//
// Gated behind ProfileSettings.useOnlineVoices so it's strictly opt-in -
// every invocation sends the field text to translate.google.com.

const ENDPOINT = "https://translate.google.com/translate_tts";

// Single-request char ceiling. The endpoint truncates above ~200 chars. For
// flashcard text this is plenty; if a card exceeds it we fall back to local.
const MAX_TEXT_LENGTH = 200;

let currentAudio: HTMLAudioElement | null = null;

export function cancelOnlineSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    currentAudio.load();
    currentAudio = null;
  }
}

export type OnlineSpeakFailure =
  | "too-long"
  | "offline"
  | "play-error";

export interface OnlineSpeakResult {
  ok: boolean;
  reason?: OnlineSpeakFailure;
}

function buildUrl(text: string, lang: string): string {
  // The endpoint accepts both primary subtags ("fr") and some regional
  // tags ("pt-BR", "zh-CN", "en-GB"). Pass through lower-cased; if Google
  // doesn't recognise the regional variant it falls back to the primary.
  const tl = lang.toLowerCase();
  const params = new URLSearchParams({
    ie: "UTF-8",
    q: text,
    tl,
    client: "tw-ob",
  });
  return `${ENDPOINT}?${params.toString()}`;
}

export async function speakOnline(
  text: string,
  lang: string,
): Promise<OnlineSpeakResult> {
  cancelOnlineSpeech();

  const trimmed = text.trim();
  if (!trimmed) return { ok: true };
  if (trimmed.length > MAX_TEXT_LENGTH) {
    return { ok: false, reason: "too-long" };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline" };
  }

  const audio = new Audio(buildUrl(trimmed, lang));
  audio.preload = "auto";
  currentAudio = audio;

  try {
    await audio.play();
    return { ok: true };
  } catch {
    if (currentAudio === audio) currentAudio = null;
    return { ok: false, reason: "play-error" };
  }
}
