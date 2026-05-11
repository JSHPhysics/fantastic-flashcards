import { useRef, useState } from "react";
import { compressImage } from "../../media/image";
import { storeMedia } from "../../db";
import { useObjectUrl } from "../../media/useObjectUrl";
import { ImageSourceDialog } from "./ImageSourceDialog";

interface ImageInputProps {
  imageHash?: string;
  onChange: (next: string | undefined) => void;
  label?: string;
}

// Adds an image to a RichField. Tapping "Add image" opens a source picker;
// the user either uploads a file or pastes from the clipboard. The same
// compressImage pipeline is used for both paths so deduplication still works
// (hash-keyed media table).
//
// The clipboard read uses navigator.clipboard.read(), which is available in
// modern Chrome / Edge / Safari over HTTPS (GH Pages provides this).

export function ImageInput({ imageHash, onChange, label }: ImageInputProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const previewUrl = useObjectUrl(imageHash);

  const handleFile = async (file: File | Blob) => {
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      await storeMedia({
        hash: compressed.hash,
        blob: compressed.blob,
        mimeType: compressed.mimeType,
        bytes: compressed.bytes,
      });
      onChange(compressed.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image import failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasteFromClipboard = async (): Promise<void> => {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      throw new Error(
        "Clipboard reads aren't supported on this browser. Paste with Ctrl+V / Cmd+V instead.",
      );
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        await handleFile(blob);
        return;
      }
    }
    throw new Error(
      "No image found on the clipboard. Take a screenshot first, then try again.",
    );
  };

  if (imageHash && previewUrl) {
    return (
      <div className="relative inline-block">
        <img
          src={previewUrl}
          alt={label ?? "Card image"}
          className="max-h-40 max-w-full rounded-xl border border-ink-200 object-contain dark:border-dark-surface"
        />
        <button
          type="button"
          aria-label="Remove image"
          onClick={() => onChange(undefined)}
          className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-ink-700 shadow ring-1 ring-ink-200 hover:text-again dark:bg-dark-surface dark:text-ink-300 dark:ring-dark-surface"
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

  return (
    <div className="space-y-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => setDialogOpen(true)}
        className="tap-target inline-flex items-center gap-2 rounded-xl border border-ink-300 bg-surface px-4 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50 dark:border-dark-surface dark:bg-dark-bg dark:text-ink-300"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="9" cy="11" r="1.6" fill="currentColor" />
          <path
            d="m3 17 5-5 5 4 3-2 5 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        {busy ? "Importing..." : "Add image"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-again">
          {error}
        </p>
      )}

      <ImageSourceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onUploadClick={() => fileInputRef.current?.click()}
        onPasteClick={handlePasteFromClipboard}
        busyMessage={busy ? "Importing..." : null}
      />
    </div>
  );
}
