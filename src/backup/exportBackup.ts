// Build a single .flashcards (zip) backup of the whole local database.
// Layout per Playbook section 4:
//   - manifest.json
//   - profile.json
//   - decks.json
//   - cards.json
//   - reviews.json
//   - sessions.json
//   - media/<hash>.<ext>

import { zip } from "fflate";
import { db } from "../db/schema";
import { markBackupSaved } from "../db/profile";
import {
  BACKUP_SCHEMA_VERSION,
  extensionForMime,
  type BackupManifest,
} from "./format";

const encoder = new TextEncoder();

function jsonEntry(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value, null, 0));
}

export async function exportBackup(
  appVersion: string,
  options: { now?: Date } = {},
): Promise<Blob> {
  const now = options.now ?? new Date();

  const [profile, decks, cards, reviews, sessions, media] = await Promise.all([
    db.profile.get("self"),
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.sessions.toArray(),
    db.media.toArray(),
  ]);

  const manifest: BackupManifest = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt: now.getTime(),
    profileVersion: profile?.version ?? 0,
    counts: {
      decks: decks.length,
      cards: cards.length,
      reviews: reviews.length,
      sessions: sessions.length,
      media: media.length,
    },
    mediaBytes: media.reduce((sum, m) => sum + m.bytes, 0),
    media: media.map((m) => ({
      hash: m.hash,
      mimeType: m.mimeType,
      bytes: m.bytes,
    })),
  };

  // fflate's input shape is a nested object; flat paths like "media/abc.webp"
  // become files inside a "media/" folder. Each value is a Uint8Array.
  const files: Record<string, Uint8Array> = {
    "manifest.json": jsonEntry(manifest),
    "profile.json": jsonEntry(profile ?? null),
    "decks.json": jsonEntry(decks),
    "cards.json": jsonEntry(cards),
    "reviews.json": jsonEntry(reviews),
    "sessions.json": jsonEntry(sessions),
  };

  // Stream the blobs into the zip. arrayBuffer() is synchronous-ish (returns
  // a Promise resolved on the next tick); doing them sequentially keeps
  // memory pressure low on devices with thousands of media items.
  for (const m of media) {
    const buf = new Uint8Array(await m.blob.arrayBuffer());
    files[`media/${m.hash}.${extensionForMime(m.mimeType)}`] = buf;
  }

  const zipped: Uint8Array = await new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  await markBackupSaved();

  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

// File name per Playbook section 13. ISO-ish so they sort lexicographically.
export function defaultBackupFilename(
  profileVersion: number,
  now: Date = new Date(),
): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `flashcards-${y}-${m}-${d}T${hh}${mm}-v${profileVersion}.flashcards`;
}

// Share where supported (iPad / iOS opens the system share sheet so the user
// can save to Files, OneDrive, iCloud, etc.); fall back to a download anchor
// on platforms without Web Share or share-with-files support.
export async function offerBackupBlob(
  blob: Blob,
  filename: string,
): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      // Fall through to download.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
