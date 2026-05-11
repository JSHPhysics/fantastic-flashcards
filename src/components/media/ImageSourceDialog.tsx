import { useState } from "react";
import { Dialog } from "../Dialog";
import { Button } from "../Button";

interface ImageSourceDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadClick: () => void;
  onPasteClick: () => Promise<void>;
  // Optional. Present when the caller has wired up a camera-capture flow.
  // Hidden when undefined so platforms / configurations without camera
  // support don't see a dead button.
  onCameraClick?: () => void;
  busyMessage?: string | null;
}

// Two-option chooser shown when the user taps "Add image". Upload opens a
// file picker (the same flow that already worked); Paste reads an image off
// the clipboard so screenshot tooling (Win+Shift+S, Cmd+Ctrl+Shift+4, etc.)
// can hand its output straight to the card editor.
//
// A web app can't invoke the OS snipping tool itself, so the dialog frames
// the keyboard shortcut as part of the user's workflow.

export function ImageSourceDialog({
  open,
  onClose,
  onUploadClick,
  onPasteClick,
  onCameraClick,
  busyMessage,
}: ImageSourceDialogProps) {
  const [error, setError] = useState<string | null>(null);

  const handlePaste = async () => {
    setError(null);
    try {
      await onPasteClick();
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Couldn't read the clipboard";
      setError(msg);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Add image"
      description="Pick a file or paste a screenshot."
      footer={
        <Button
          variant="ghost"
          onClick={() => {
            setError(null);
            onClose();
          }}
        >
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        <SourceTile
          icon={<UploadIcon />}
          title="Upload from device"
          subtitle="Choose a JPG, PNG, HEIC, or other image file."
          onClick={() => {
            onUploadClick();
            onClose();
          }}
        />
        {onCameraClick && (
          <SourceTile
            icon={<CameraIcon />}
            title="Take a photo"
            subtitle="Use this device's camera. Handwriting and paper get an automatic touch-up."
            onClick={() => {
              onCameraClick();
              onClose();
            }}
          />
        )}
        <SourceTile
          icon={<ClipboardIcon />}
          title="Paste from clipboard"
          subtitle="Take a screenshot first (Win+Shift+S, or Cmd+Ctrl+Shift+4 on macOS), then tap this."
          onClick={handlePaste}
        />
        {busyMessage && (
          <p className="text-sm text-ink-500 dark:text-ink-300">
            {busyMessage}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-again">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

function SourceTile({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target flex w-full items-start gap-3 rounded-xl border border-ink-200 bg-surface p-4 text-left transition-colors hover:bg-ink-100 dark:border-dark-surface dark:bg-dark-bg dark:hover:bg-dark-surface/70"
    >
      <span
        aria-hidden
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy dark:bg-gold/15 dark:text-gold"
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-base font-medium text-ink-900 dark:text-dark-ink">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-500 dark:text-ink-300">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M12 4v12M7 9l5-5 5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <rect
        x="6"
        y="5"
        width="12"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="9"
        y="3"
        width="6"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3v11H4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13"
        r="3.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
