import { useEffect, useState } from "react";

// Wraps speechSynthesis.getVoices() with iOS's async voice loading. On
// iOS / iPadOS Safari the voice list is empty on the first synchronous call
// and is populated later, dispatching "voiceschanged". The hook subscribes,
// returns the current list, and updates as voices stream in.

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    typeof speechSynthesis !== "undefined" ? speechSynthesis.getVoices() : [],
  );

  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const refresh = () => setVoices(speechSynthesis.getVoices());
    refresh();
    speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      speechSynthesis.removeEventListener("voiceschanged", refresh);
    };
  }, []);

  return voices;
}

// True if speechSynthesis is exposed by the runtime (every modern browser
// shipping the app; older Safari versions on iPad pre-iOS 14 don't).
export function hasSpeechSynthesis(): boolean {
  return typeof speechSynthesis !== "undefined";
}
