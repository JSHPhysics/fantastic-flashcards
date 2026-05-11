// Shared format constants for .flashcards backup files.
// Bumped only on incompatible changes; minor schema additions stay
// backwards-compatible because importers tolerate unknown fields.

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupManifest {
  schemaVersion: number;
  appVersion: string;
  exportedAt: number; // ms timestamp
  profileVersion: number;
  counts: {
    decks: number;
    cards: number;
    reviews: number;
    sessions: number;
    media: number;
  };
  mediaBytes: number;
  // Per-media metadata so the importer can reconstruct each Blob with the
  // right MIME type without re-sniffing.
  media: { hash: string; mimeType: string; bytes: number }[];
}

// Common image / audio MIME -> extension. Used purely as a cosmetic hint
// inside the zip so a user opening it in Finder / Explorer sees something
// recognisable. Importer reads MIME from the manifest, not the filename.
export function extensionForMime(mime: string): string {
  const lower = mime.toLowerCase();
  if (lower.startsWith("image/webp")) return "webp";
  if (lower.startsWith("image/png")) return "png";
  if (lower.startsWith("image/jpeg")) return "jpg";
  if (lower.startsWith("image/heic")) return "heic";
  if (lower.startsWith("image/gif")) return "gif";
  if (lower.startsWith("audio/webm")) return "webm";
  if (lower.startsWith("audio/mp4")) return "m4a";
  if (lower.startsWith("audio/mpeg")) return "mp3";
  if (lower.startsWith("audio/")) return "audio";
  return "bin";
}
