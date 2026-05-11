// Module-level voice cache + ranked picker. The browser's voice list is
// populated asynchronously on iOS Safari and on first page-load in Chrome,
// so `speak()` cannot trust a synchronous `speechSynthesis.getVoices()` call.
// This module subscribes to "voiceschanged" once at module load and keeps a
// cached array that every consumer (speak, useVoices, SpeakerButton tooltip)
// reads from, so a voice picked at module-init time doesn't get stuck.

import { bcp47Equal, primarySubtag } from "./languages";

let cachedVoices: SpeechSynthesisVoice[] = [];

const listeners = new Set<() => void>();

function refresh() {
  if (typeof speechSynthesis === "undefined") return;
  cachedVoices = speechSynthesis.getVoices();
  for (const fn of listeners) fn();
}

if (typeof speechSynthesis !== "undefined") {
  refresh();
  speechSynthesis.addEventListener("voiceschanged", refresh);
}

export function getCurrentVoices(): SpeechSynthesisVoice[] {
  // Late callers may arrive before voiceschanged has fired; do one direct
  // poll to cover that race.
  if (cachedVoices.length === 0 && typeof speechSynthesis !== "undefined") {
    cachedVoices = speechSynthesis.getVoices();
  }
  return cachedVoices;
}

export function subscribeVoiceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Heuristic quality score per voice name. Enhanced / Premium / Neural /
// Natural / Google branded voices sound substantially better than basic
// "compact" voices for the same language. The numeric weights are arbitrary
// but rank-stable.
const HIGH_QUALITY_KEYWORDS = [
  "enhanced",
  "premium",
  "neural",
  "natural",
  "studio",
  "wavenet",
];
const ONLINE_KEYWORDS = ["google", "online", "cloud"];
const LOW_QUALITY_KEYWORDS = ["compact", "espeak", "festival"];

export function voiceQualityScore(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  let score = 0;
  for (const kw of HIGH_QUALITY_KEYWORDS) {
    if (name.includes(kw)) score += 4;
  }
  for (const kw of ONLINE_KEYWORDS) {
    if (name.includes(kw)) score += 2;
  }
  for (const kw of LOW_QUALITY_KEYWORDS) {
    if (name.includes(kw)) score -= 2;
  }
  // Local voices feel snappier and don't depend on a network round trip.
  // Slight nudge so a comparable-quality local voice beats a remote one.
  if (voice.localService) score += 1;
  return score;
}

export function pickVoice(
  lang: string,
): SpeechSynthesisVoice | undefined {
  const voices = getCurrentVoices();
  if (voices.length === 0) return undefined;

  const exact = voices
    .filter((v) => bcp47Equal(v.lang, lang))
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
  if (exact.length > 0) return exact[0];

  const primary = primarySubtag(lang);
  const regional = voices
    .filter((v) => primarySubtag(v.lang) === primary)
    .sort((a, b) => voiceQualityScore(b) - voiceQualityScore(a));
  if (regional.length > 0) return regional[0];

  return undefined;
}

export function hasSpeechSynthesis(): boolean {
  return typeof speechSynthesis !== "undefined";
}
