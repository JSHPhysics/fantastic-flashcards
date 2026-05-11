// Audio recording. MediaRecorder mono at the lowest bitrate the browser will
// accept. Hard cap of 15s per Playbook section 5; UI shows a countdown and
// auto-stops when the cap is hit. A safety timeout inside startRecording is
// belt-and-braces.
//
// Critical detail: the "stop" event listener is registered at construction
// time (before recorder.start()). If we registered it lazily inside stop()
// instead, the safety timer could fire first, dispatch the "stop" event with
// no listener attached, and the eventual UI-driven stop() would then await an
// event that never fires again. Registering once up front avoids that race.

import { sha256Hex } from "./hash";

export const MAX_RECORD_SECONDS = 15;

export interface RecordedAudio {
  blob: Blob;
  hash: string;
  bytes: number;
  mimeType: string;
  durationMs: number;
}

export interface ActiveRecording {
  stop(): Promise<RecordedAudio>;
  cancel(): void;
  // Time the recorder started, in performance.now() units. UI uses this to
  // tick down a visible countdown.
  startedAt: number;
}

// Browsers differ on which codec they accept. Try webm/opus first (Chrome,
// Edge, Firefox, recent Safari) and fall back to mp4/aac on older Safari.
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return undefined;
}

export async function startRecording(): Promise<ActiveRecording> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder not supported in this browser");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1 },
  });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined,
  );

  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  });

  // Resolves when the recorder fires "stop", whoever triggered it (user,
  // safety timer, or cancel). Registered once at construction.
  let resolveStopped: (() => void) | null = null;
  const stoppedPromise = new Promise<void>((res) => {
    resolveStopped = res;
  });
  recorder.addEventListener(
    "stop",
    () => {
      for (const t of stream.getTracks()) t.stop();
      resolveStopped?.();
    },
    { once: true },
  );

  const startedAt = performance.now();
  recorder.start();

  const safetyTimer = window.setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, MAX_RECORD_SECONDS * 1000);

  let cancelled = false;

  return {
    startedAt,
    stop: async (): Promise<RecordedAudio> => {
      window.clearTimeout(safetyTimer);
      if (recorder.state !== "inactive") recorder.stop();
      await stoppedPromise;
      if (cancelled) throw new Error("Recording cancelled");
      if (chunks.length === 0) throw new Error("No audio captured");
      const blob = new Blob(chunks, {
        type: chunks[0].type || mimeType || "audio/webm",
      });
      const hash = await sha256Hex(blob);
      return {
        blob,
        hash,
        bytes: blob.size,
        mimeType: blob.type || mimeType || "audio/webm",
        durationMs: performance.now() - startedAt,
      };
    },
    cancel: () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // Already stopped; the stop listener still resolves stoppedPromise.
      }
    },
  };
}
