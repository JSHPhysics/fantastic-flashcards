// Online pronunciation via Google's translate-TTS endpoint. Not an officially
// supported API but stable for years and used by many language tools. The
// audio is loaded with a plain HTMLAudioElement, which bypasses CORS for
// cross-origin media (the browser plays it directly, no JS-side fetch).
//
// Two implementation notes the first version got wrong:
// 1. The audio element MUST be attached to the document. Some browsers
//    (notably Chrome on certain platforms) refuse to play a detached
//    HTMLAudioElement under autoplay policy even with a user gesture
//    chain. Attaching it to <body> sidesteps that.
// 2. We listen for the "error" event in addition to awaiting play(). The
//    play() Promise can resolve on "playback started" without surfacing a
//    later loading failure, so the "error" event is the source of truth for
//    "this audio is dead".
//
// Gated behind ProfileSettings.useOnlineVoices so it's strictly opt-in -
// every invocation sends the field text to translate.google.com.

const ENDPOINT = "https://translate.google.com/translate_tts";

// Single-request char ceiling. The endpoint truncates above ~200 chars. For
// flashcard text this is plenty; if a card exceeds it we fall back to local.
const MAX_TEXT_LENGTH = 200;

let currentAudio: HTMLAudioElement | null = null;
let lastError: { url: string; error: unknown } | null = null;

export function cancelOnlineSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.removeAttribute("src");
    try {
      currentAudio.load();
    } catch {
      // Some browsers throw if the element is mid-detach; safe to ignore.
    }
    if (currentAudio.parentNode) currentAudio.parentNode.removeChild(currentAudio);
    currentAudio = null;
  }
}

export type OnlineSpeakFailure =
  | "too-long"
  | "offline"
  | "play-error"
  | "load-error";

export interface OnlineSpeakResult {
  ok: boolean;
  reason?: OnlineSpeakFailure;
}

// Expose the last failure for diagnosis. The Settings debug panel surfaces it.
export function getLastOnlineSpeechError(): { url: string; error: unknown } | null {
  return lastError;
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

  const url = buildUrl(trimmed, lang);
  const audio = document.createElement("audio");
  // Belt and braces: index.html sets a document-wide referrer policy of
  // "no-referrer" because Google's translate-TTS endpoint returns a 404
  // HTML page when a Referer header is present. Setting it via the HTML
  // attribute here (referrerPolicy isn't part of HTMLAudioElement's typed
  // interface, but the underlying attribute is honored by browsers that
  // extend it to media elements) is harmless and protects against any
  // future template change.
  audio.setAttribute("referrerpolicy", "no-referrer");
  audio.src = url;
  audio.preload = "auto";
  // crossOrigin is left as the default (null). Setting it to "anonymous"
  // would require CORS headers the endpoint does not provide; the default
  // tainted-but-playable mode is what we want for plain playback.
  // Hidden but attached so the browser treats it as a "live" media element.
  audio.style.position = "fixed";
  audio.style.left = "-9999px";
  audio.style.width = "1px";
  audio.style.height = "1px";
  document.body.appendChild(audio);
  currentAudio = audio;

  // Watch the "error" event for load-stage failures the play() Promise can
  // miss. ended cleans up the element after playback finishes.
  const cleanup = () => {
    if (audio.parentNode) audio.parentNode.removeChild(audio);
    if (currentAudio === audio) currentAudio = null;
  };
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });

  try {
    await audio.play();
    return { ok: true };
  } catch (err) {
    lastError = { url, error: err };
    console.warn(
      "[tts] online speak failed; falling back to local voice",
      { url, error: err },
    );
    cleanup();
    return { ok: false, reason: "play-error" };
  }
}
