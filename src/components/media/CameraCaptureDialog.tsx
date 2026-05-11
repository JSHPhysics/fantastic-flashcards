import { useEffect, useRef, useState } from "react";
import { Dialog } from "../Dialog";
import { Button } from "../Button";
import {
  captureFrameToCanvas,
  openCameraStream,
  stopStream,
} from "../../media/camera";
import { canvasToProcessedBlob } from "../../media/document";

interface CameraCaptureDialogProps {
  open: boolean;
  onClose: () => void;
  // Called with a ready-to-store Blob when the user accepts a capture.
  // The caller passes this through their image pipeline (storeMedia +
  // hash) - typically the same path that handles file uploads.
  onCaptured: (blob: Blob) => void;
}

// In-app camera. Opens the device camera, shows a live preview, lets the
// user snap a photo, applies document-mode touch-up by default, and hands
// the processed Blob back to the caller.

export function CameraCaptureDialog({
  open,
  onClose,
  onCaptured,
}: CameraCaptureDialogProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawCanvas, setRawCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [documentMode, setDocumentMode] = useState(true);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start / stop the camera stream as the dialog opens and closes.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError(null);
    setRawCanvas(null);
    setPreviewUrl(null);
    setProcessedBlob(null);
    openCameraStream(true)
      .then((s) => {
        if (!active) {
          stopStream(s);
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch((err) => {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.name === "NotAllowedError"
              ? "Camera permission denied. Allow camera access in your browser settings and try again."
              : err.name === "NotFoundError"
                ? "No camera was found on this device."
                : err.message
            : "Couldn't open the camera";
        setError(msg);
      });
    return () => {
      active = false;
      setStream((prev) => {
        stopStream(prev);
        return null;
      });
    };
  }, [open]);

  // Re-attach the stream to the video element whenever either changes.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Re-process the captured frame whenever the document-mode toggle flips.
  useEffect(() => {
    if (!rawCanvas) {
      setProcessedBlob(null);
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    setProcessing(true);
    canvasToProcessedBlob(rawCanvas, { documentMode })
      .then((blob) => {
        if (cancelled) return;
        setProcessedBlob(blob);
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Processing failed");
      })
      .finally(() => {
        if (!cancelled) setProcessing(false);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [rawCanvas, documentMode]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    try {
      const canvas = captureFrameToCanvas(video);
      setRawCanvas(canvas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed");
    }
  };

  const retake = () => {
    setRawCanvas(null);
    setPreviewUrl(null);
    setProcessedBlob(null);
  };

  const accept = () => {
    if (!processedBlob) return;
    onCaptured(processedBlob);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Take a photo"
      description={
        rawCanvas
          ? "Check the result, then save it or retake."
          : "Frame what you want to capture and tap Take photo."
      }
      footer={
        rawCanvas ? (
          <>
            <Button variant="ghost" onClick={retake}>
              Retake
            </Button>
            <Button onClick={accept} disabled={!processedBlob || processing}>
              {processing ? "Processing..." : "Use this photo"}
            </Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {error ? (
          <div className="rounded-xl border border-again/30 bg-again/10 p-3 text-sm text-again">
            {error}
          </div>
        ) : rawCanvas && previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Captured photo"
              className="block max-h-[60vh] w-full rounded-lg object-contain"
            />
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={documentMode}
                onChange={(e) => setDocumentMode(e.target.checked)}
                className="mt-1 h-4 w-4 accent-navy"
              />
              <span className="text-sm">
                <span className="block font-medium text-ink-900 dark:text-dark-ink">
                  Document touch-up
                </span>
                <span className="block text-xs text-ink-500 dark:text-ink-300">
                  Boost contrast so paper looks white and writing stands out.
                  Turn off if you'd rather keep the photo as-is.
                </span>
              </span>
            </label>
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg bg-ink-900">
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="block max-h-[60vh] w-full"
              />
            </div>
            <div className="flex justify-center">
              <Button onClick={takePhoto} disabled={!stream}>
                Take photo
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
