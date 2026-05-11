import { useEffect, useState } from "react";
import {
  getCurrentVoices,
  hasSpeechSynthesis as _hasSpeechSynthesis,
  subscribeVoiceChange,
} from "./voices";

// React hook over the module-level voice cache. Components rerender whenever
// the browser's voice list changes (iPad voices stream in async after first
// page load; downloading an Enhanced voice in Settings doesn't fire any
// event until the next "voiceschanged" tick).

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    getCurrentVoices(),
  );
  useEffect(() => {
    const unsubscribe = subscribeVoiceChange(() => {
      setVoices(getCurrentVoices());
    });
    // Also re-poll once on mount, in case voices arrived between module init
    // and this component mounting.
    setVoices(getCurrentVoices());
    return unsubscribe;
  }, []);
  return voices;
}

// Re-exported for any caller that imported it from the old location.
export const hasSpeechSynthesis = _hasSpeechSynthesis;
