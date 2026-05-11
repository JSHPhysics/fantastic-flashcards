// Live-camera helpers. We use getUserMedia + an in-app preview instead of
// the native `<input capture>` attribute because:
// - Desktop browsers usually treat `<input capture>` as a regular file
//   picker, so the in-app preview gives a consistent UX across platforms.
// - We can offer document-mode touch-up before the user commits the photo.
//
// HTTPS only - which we have on GH Pages.

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export async function openCameraStream(
  preferEnvironment = true,
): Promise<MediaStream> {
  if (!isCameraSupported()) {
    throw new Error(
      "This device doesn't expose a camera through the browser. Use Upload from device instead.",
    );
  }
  // The back camera is best for documents / handwriting. We request it as an
  // "ideal" so a desktop without one falls back to whatever's available
  // rather than rejecting.
  return navigator.mediaDevices.getUserMedia({
    video: preferEnvironment
      ? { facingMode: { ideal: "environment" } }
      : true,
    audio: false,
  });
}

// Draw the current video frame onto a fresh canvas at the video's intrinsic
// resolution. Returns the canvas so the caller can post-process before
// encoding (document-mode touch-up, resize, etc.).
export function captureFrameToCanvas(
  video: HTMLVideoElement,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0);
  return canvas;
}

export function stopStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
