import { hasSpeechSynthesis, pickVoice } from "./voices";
import { cancelOnlineSpeech, speakOnline } from "./online";

// Speak `text` in the requested BCP 47 language. Two paths:
//
// - LOCAL (default): uses speechSynthesis with the highest-quality matching
//   voice via pickVoice (Enhanced / Premium / Neural > Compact > nothing).
//   Quality depends on what the device has installed.
//
// - ONLINE (opt-in via options.online or ProfileSettings.useOnlineVoices):
//   plays Google's translate-TTS endpoint through an <audio> element. Sends
//   the field text to translate.google.com each call. Falls back to the local
//   path if the online request fails (offline, text too long, etc.).
//
// Always cancels any in-progress utterance / audio first so fast tapping
// doesn't queue clips.

export interface SpeakOptions {
  online?: boolean;
}

// Monotonic invocation counter. Each call increments and captures its own
// generation; the online-fallback closure compares against the current value
// so it doesn't fire stale fallbacks for a click the user has already moved
// past with a second click.
let speakInvocation = 0;

export function speak(text: string, lang: string, options: SpeakOptions = {}): void {
  if (!text.trim()) return;
  cancelSpeech();
  const mine = ++speakInvocation;

  if (options.online) {
    void speakOnline(text, lang).then((result) => {
      if (mine !== speakInvocation) return; // user clicked again; abandon
      if (result.ok) return;
      // Fallback: if online didn't work for any reason, try a local voice
      // so the user still hears something. Won't sound as good but beats
      // silence.
      speakLocal(text, lang);
    });
    return;
  }

  speakLocal(text, lang);
}

function speakLocal(text: string, lang: string): void {
  if (!hasSpeechSynthesis()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const voice = pickVoice(lang);
  if (voice) {
    utterance.voice = voice;
    // Match utterance.lang to the actual voice's lang so browsers don't
    // second-guess the picker (e.g. an fr-CA voice playing fr-FR text).
    utterance.lang = voice.lang;
  }
  speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (hasSpeechSynthesis()) speechSynthesis.cancel();
  cancelOnlineSpeech();
}
