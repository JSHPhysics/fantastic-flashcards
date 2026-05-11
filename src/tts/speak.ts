import { bcp47Equal, primarySubtag } from "./languages";

// Speak `text` in the requested BCP 47 language. Picks the best available
// voice in this priority order:
// 1. Exact lang match
// 2. Primary-subtag match (e.g. "fr-FR" requested, "fr-CA" available)
// 3. Whatever the browser picks based on utterance.lang alone
// Cancels any in-progress speech so a fast-tapping user doesn't queue clips.

export function speak(text: string, lang: string): void {
  if (typeof speechSynthesis === "undefined") return;
  if (!text.trim()) return;
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const voices = speechSynthesis.getVoices();
  const exact = voices.find((v) => bcp47Equal(v.lang, lang));
  if (exact) {
    utterance.voice = exact;
  } else {
    const primary = primarySubtag(lang);
    const fallback = voices.find(
      (v) => primarySubtag(v.lang) === primary,
    );
    if (fallback) utterance.voice = fallback;
  }

  speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
  }
}
