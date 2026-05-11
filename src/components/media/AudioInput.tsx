import { useEffect, useRef, useState } from "react";
import {
  MAX_RECORD_SECONDS,
  startRecording,
  type ActiveRecording,
} from "../../media/audio";
import { getMedia, storeMedia } from "../../db";
import { objectUrlFromBlob } from "../../media/image";

interface AudioInputProps {
  audioHash?: string;
  onChange: (next: string | undefined) => void;
}

export function AudioInput({ audioHash, onChange }: AudioInputProps) {
  const [recording, setRecording] = useState<ActiveRecording | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);

  // Load preview URL when an audio hash is set.
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setAudioUrl(null);
    if (!audioHash) return;
    (async () => {
      const m = await getMedia(audioHash);
      if (!m || cancelled) return;
      url = objectUrlFromBlob(m.blob);
      setAudioUrl(url);
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioHash]);

  // Tick the countdown while recording. Auto-stop at the cap.
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const next = performance.now() - recording.startedAt;
      setElapsedMs(next);
      if (next >= MAX_RECORD_SECONDS * 1000) {
        void finishRecording();
      }
    }, 100);
    tickRef.current = id;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const beginRecording = async () => {
    setError(null);
    try {
      const r = await startRecording();
      setRecording(r);
      setElapsedMs(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone unavailable");
    }
  };

  const finishRecording = async () => {
    const r = recording;
    if (!r) return;
    setBusy(true);
    setRecording(null);
    try {
      const rec = await r.stop();
      await storeMedia({
        hash: rec.hash,
        blob: rec.blob,
        mimeType: rec.mimeType,
        bytes: rec.bytes,
      });
      onChange(rec.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed");
    } finally {
      setBusy(false);
    }
  };

  const cancelRecording = () => {
    recording?.cancel();
    setRecording(null);
    setElapsedMs(0);
  };

  if (audioHash && audioUrl) {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-surface px-3 py-1.5 dark:border-dark-surface dark:bg-dark-bg">
        <audio controls src={audioUrl} className="h-8" />
        <button
          type="button"
          aria-label="Remove audio"
          onClick={() => onChange(undefined)}
          className="tap-target inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-again dark:hover:bg-dark-surface"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  if (recording) {
    const secs = Math.min(MAX_RECORD_SECONDS, Math.ceil(elapsedMs / 1000));
    const remaining = MAX_RECORD_SECONDS - secs;
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-again/40 bg-again/10 px-3 py-1.5 text-sm">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-again" />
        <span className="font-medium text-again">
          Recording... {remaining}s left
        </span>
        <button
          type="button"
          onClick={finishRecording}
          className="tap-target inline-flex items-center justify-center rounded-full px-3 text-xs font-semibold text-cream bg-again hover:bg-again/90"
        >
          Stop
        </button>
        <button
          type="button"
          onClick={cancelRecording}
          className="tap-target inline-flex items-center justify-center rounded-full px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-dark-surface"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={beginRecording}
        disabled={busy}
        className="tap-target inline-flex items-center gap-2 rounded-xl border border-ink-300 bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50 dark:border-dark-surface dark:bg-dark-bg dark:text-ink-300"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <rect
            x="9"
            y="3"
            width="6"
            height="12"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M5 11a7 7 0 0 0 14 0M12 18v3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {busy ? "Saving..." : "Record audio"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-again">
          {error}
        </p>
      )}
    </div>
  );
}
