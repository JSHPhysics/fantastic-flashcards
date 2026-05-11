import { hasSpeechSynthesis, pickVoice } from "./voices";

// Speak `text` in the requested BCP 47 language. Picks the highest-quality
// available voice in priority order via pickVoice:
//   1. Exact lang match, ranked by quality (Enhanced / Premium / Neural...)
//   2. Primary-subtag match (e.g. "fr-FR" requested, "fr-CA" available),
//      again ranked by quality
//   3. No voice: utterance.lang alone is the only hint to the browser.
//
// Cancels any in-progress speech so a fast-tapping user doesn't queue clips
// (the Web Speech API queues by default).

export function speak(text: string, lang: string): void {
  if (!hasSpeechSynthesis()) return;
  if (!text.trim()) return;
  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;

  const voice = pickVoice(lang);
  if (voice) {
    utterance.voice = voice;
    // Setting utterance.lang to the voice's actual lang prevents some browsers
    // from second-guessing the picker when the voice's lang differs from our
    // request (e.g. fr-CA voice for fr-FR text).
    utterance.lang = voice.lang;
  }

  speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (hasSpeechSynthesis()) speechSynthesis.cancel();
}
