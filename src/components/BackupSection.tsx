import { useRef, useState } from "react";
import { useProfile } from "../db";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import type { BackupPreview } from "../backup/importBackup";
import {
  DAILY_BACKUP_BONUS,
  hasEarnedBackupBonusToday,
} from "../gamification/coins";

// fflate + the backup helpers are heavy (~40 KB raw) and only run when the
// user actually clicks Export or Import. Dynamic-importing keeps them out
// of the main bundle.
async function loadExporter() {
  return import("../backup/exportBackup");
}
async function loadImporter() {
  return import("../backup/importBackup");
}

// Export / Import controls + a "Last backup" indicator. Lives at the top of
// Settings so it's hard to miss.
//
// Export: builds a .flashcards file from the current database and offers it
// to the OS share sheet (iPad / iOS) or downloads as a fallback. Updates
// profile.lastBackupAt on success so the 20-hour nudge stops firing.
//
// Import: parses the picked file, previews the diff, and (after the user
// confirms) replaces local data wholesale.

export function BackupSection() {
  const profile = useProfile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  // Last successful export's positive message — coin bonus if earned, or a
  // "saved" confirmation otherwise. Cleared when a new export starts.
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const lastBackupAt = profile?.lastBackupAt ?? 0;
  const lastChangeAt = profile?.lastChangeAt ?? 0;
  const hasUnsavedChanges =
    lastChangeAt > lastBackupAt && lastBackupAt > 0;
  const earnedBackupBonusToday = hasEarnedBackupBonusToday(profile?.settings);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const exporter = await loadExporter();
      const { blob, coinBonus } = await exporter.exportBackup(__APP_VERSION__);
      const filename = exporter.defaultBackupFilename(profile?.version ?? 0);
      await exporter.offerBackupBlob(blob, filename);
      setExportSuccess(
        coinBonus.awarded > 0
          ? `Backup saved · +${coinBonus.awarded} coins`
          : "Backup saved",
      );
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    setImportError(null);
    setImportSuccess(null);
    try {
      const importer = await loadImporter();
      const preview = await importer.previewBackup(file);
      setPendingFile(file);
      setImportPreview(preview);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't read that file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!pendingFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const importer = await loadImporter();
      const artifacts = await importer.applyBackup(pendingFile);
      setImportSuccess(
        `Restored ${artifacts.decks.length} deck${artifacts.decks.length === 1 ? "" : "s"} with ${artifacts.cards.length} card${artifacts.cards.length === 1 ? "" : "s"}.`,
      );
      setImportPreview(null);
      setPendingFile(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="card-surface p-6">
      <p className="font-medium text-ink-900 dark:text-dark-ink">
        Back up to a file
      </p>
      <p className="mt-1 text-sm text-ink-500 dark:text-ink-300">
        Save a single .flashcards file with all your decks, cards, images,
        audio, and history. Move it to another device and import to copy
        everything over.
      </p>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
        On iPad the Files picker shows everything in a folder — look for the
        most recent file starting with "flashcards-".
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Last backup
          </p>
          <p className="mt-1 text-sm text-ink-900 dark:text-dark-ink">
            {lastBackupAt === 0
              ? "Never backed up yet"
              : formatRelative(lastBackupAt)}
            {hasUnsavedChanges && (
              <span className="ml-1 text-hard">· changes since</span>
            )}
          </p>
          {/* Daily-bonus chip. Pre-earn: gentle nudge with the amount.
              Post-earn: confirmation so the student knows it's banked
              already and doesn't keep tapping Export hoping for more. */}
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">
            {earnedBackupBonusToday
              ? `+${DAILY_BACKUP_BONUS} coins earned for today's backup`
              : `Earn ${DAILY_BACKUP_BONUS} coins for today's first backup`}
          </p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 sm:justify-end">
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Building backup..." : "Export backup"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            Import backup
          </Button>
          {/* The Files picker on iPadOS doesn't always filter to the
              custom .flashcards extension — the user has to spot the
              file by name. We list both the extension and the underlying
              zip MIME types so non-iOS browsers narrow the picker; on
              iPad the wider list is harmless because the picker shows
              everything anyway. */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".flashcards,.zip,application/zip,application/x-zip-compressed,application/octet-stream"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      </div>

      {exportError && (
        <p role="alert" className="mt-2 text-xs text-again">
          {exportError}
        </p>
      )}
      {exportSuccess && (
        <p className="mt-2 text-xs text-good">{exportSuccess}</p>
      )}
      {importError && (
        <p role="alert" className="mt-2 text-xs text-again">
          {importError}
        </p>
      )}
      {importSuccess && (
        <p className="mt-2 text-xs text-good">{importSuccess}</p>
      )}

      <ImportConfirmDialog
        preview={importPreview}
        onCancel={() => {
          setImportPreview(null);
          setPendingFile(null);
        }}
        onConfirm={confirmImport}
        importing={importing}
      />
    </div>
  );
}

function ImportConfirmDialog({
  preview,
  onCancel,
  onConfirm,
  importing,
}: {
  preview: BackupPreview | null;
  onCancel: () => void;
  onConfirm: () => void;
  importing: boolean;
}) {
  const open = Boolean(preview);
  const title = preview
    ? preview.comparison === "older"
      ? "This backup is older than your local data"
      : preview.comparison === "same"
        ? "This backup matches your local data"
        : "Replace local data with this backup?"
    : "Import backup";
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description="Importing replaces everything on this device. You can't undo it - export a backup first if you have anything to keep."
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={importing}
            variant={preview?.comparison === "older" ? "danger" : "primary"}
          >
            {importing ? "Importing..." : "Replace local data"}
          </Button>
        </>
      }
    >
      {preview && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-ink-100 p-3 text-center dark:border-dark-surface">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
                In backup
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
                On this device
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
                Item
              </p>
            </div>
            <ComparisonRow
              label="Decks"
              left={preview.manifest.counts.decks}
              right={preview.local.decks}
            />
            <ComparisonRow
              label="Cards"
              left={preview.manifest.counts.cards}
              right={preview.local.cards}
            />
            <ComparisonRow
              label="Reviews"
              left={preview.manifest.counts.reviews}
              right={preview.local.reviews}
            />
            <ComparisonRow
              label="Sessions"
              left={preview.manifest.counts.sessions}
              right={preview.local.sessions}
            />
            <ComparisonRow
              label="Media"
              left={preview.manifest.counts.media}
              right={preview.local.media}
            />
          </div>
          <p className="text-xs text-ink-500 dark:text-ink-300">
            Backup made{" "}
            {formatRelative(preview.manifest.exportedAt)} (version{" "}
            {preview.manifest.profileVersion}).
            {preview.comparison === "older" &&
              " It's older than what's on this device - importing it will lose recent changes."}
            {preview.comparison === "same" &&
              " It matches the device's version, so this is effectively a re-restore."}
          </p>
        </div>
      )}
    </Dialog>
  );
}

function ComparisonRow({
  label,
  left,
  right,
}: {
  label: string;
  left: number;
  right: number;
}) {
  const diff = left - right;
  return (
    <>
      <div className="font-medium text-ink-900 dark:text-dark-ink">{left}</div>
      <div className="font-medium text-ink-900 dark:text-dark-ink">{right}</div>
      <div className="text-ink-500 dark:text-ink-300">
        {label}
        {diff !== 0 && (
          <span
            className={`ml-1 text-[11px] ${diff > 0 ? "text-good" : "text-again"}`}
          >
            ({diff > 0 ? "+" : ""}
            {diff})
          </span>
        )}
      </div>
    </>
  );
}

function formatRelative(ts: number): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
