// Parse a .flashcards backup and replace local data with its contents.
// Last-write-wins at the file level - no merge in v1 (per Playbook 4).

import { unzip } from "fflate";
import { db } from "../db/schema";
import type {
  Card,
  Deck,
  MediaBlob,
  Profile,
  ReviewEvent,
  Session,
} from "../db";
import { BACKUP_SCHEMA_VERSION, type BackupManifest } from "./format";

const decoder = new TextDecoder();

export interface BackupPreview {
  manifest: BackupManifest;
  // Counts of what's currently on this device, so the confirmation dialog
  // can show "Backup has 12 decks, 1240 cards. You have 8 decks, 980 cards."
  local: {
    profileVersion: number;
    decks: number;
    cards: number;
    reviews: number;
    sessions: number;
    media: number;
  };
  comparison: "newer" | "same" | "older";
}

export interface ImportArtifacts {
  manifest: BackupManifest;
  profile: Profile | null;
  decks: Deck[];
  cards: Card[];
  reviews: ReviewEvent[];
  sessions: Session[];
  // hash -> { mimeType, bytes, raw bytes } so the importer can rebuild Blobs.
  media: Map<string, { mimeType: string; bytes: number; bytes_: Uint8Array }>;
}

// First pass: open the zip, validate the manifest, summarise local state.
export async function previewBackup(file: Blob): Promise<BackupPreview> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipAsync(bytes);
  const manifest = readManifest(entries);

  const local = await loadLocalCounts();
  let comparison: BackupPreview["comparison"] = "same";
  if (manifest.profileVersion > local.profileVersion) comparison = "newer";
  else if (manifest.profileVersion < local.profileVersion) comparison = "older";

  return { manifest, local, comparison };
}

// Second pass: re-open the zip and apply it. Caller is responsible for
// confirming with the user first; previewBackup is the safe way to check.
export async function applyBackup(file: Blob): Promise<ImportArtifacts> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await unzipAsync(bytes);
  const manifest = readManifest(entries);

  const profile = parseJson<Profile | null>(entries, "profile.json", null);
  const decks = parseJson<Deck[]>(entries, "decks.json", []);
  const cards = parseJson<Card[]>(entries, "cards.json", []);
  const reviews = parseJson<ReviewEvent[]>(entries, "reviews.json", []);
  const sessions = parseJson<Session[]>(entries, "sessions.json", []);

  const media = new Map<string, { mimeType: string; bytes: number; bytes_: Uint8Array }>();
  for (const m of manifest.media) {
    // The exporter uses the hash as the file stem; ignore the extension and
    // match by prefix so we tolerate a different (or missing) extension.
    const key = Object.keys(entries).find(
      (k) => k.startsWith(`media/${m.hash}.`) || k === `media/${m.hash}`,
    );
    if (!key) continue;
    const bytes_ = entries[key];
    media.set(m.hash, { mimeType: m.mimeType, bytes: m.bytes, bytes_ });
  }

  // Replace local data in one transaction so a failure mid-import doesn't
  // leave the database in a half-applied state.
  await db.transaction(
    "rw",
    [db.profile, db.decks, db.cards, db.reviews, db.sessions, db.media],
    async () => {
      await db.profile.clear();
      await db.decks.clear();
      await db.cards.clear();
      await db.reviews.clear();
      await db.sessions.clear();
      await db.media.clear();

      if (profile) await db.profile.put(profile);
      if (decks.length) await db.decks.bulkAdd(decks);
      if (cards.length) await db.cards.bulkAdd(cards);
      if (reviews.length) await db.reviews.bulkAdd(reviews);
      if (sessions.length) await db.sessions.bulkAdd(sessions);

      const mediaRows: MediaBlob[] = [];
      for (const [hash, m] of media) {
        // Reconstruct the Blob from the raw bytes + the manifest's MIME.
        const blob = new Blob([m.bytes_ as BlobPart], { type: m.mimeType });
        mediaRows.push({
          hash,
          mimeType: m.mimeType,
          bytes: m.bytes,
          blob,
          refCount: 1, // we don't know the exact count, but >=1 keeps it alive
          createdAt: Date.now(),
        });
      }
      if (mediaRows.length) await db.media.bulkAdd(mediaRows);
    },
  );

  return { manifest, profile, decks, cards, reviews, sessions, media };
}

// ---- internals ----

function unzipAsync(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, entries) => {
      if (err) reject(err);
      else resolve(entries);
    });
  });
}

function readManifest(entries: Record<string, Uint8Array>): BackupManifest {
  const raw = entries["manifest.json"];
  if (!raw) {
    throw new Error(
      "This doesn't look like a Fantastic Flashcards backup (no manifest.json inside).",
    );
  }
  let parsed: BackupManifest;
  try {
    parsed = JSON.parse(decoder.decode(raw));
  } catch {
    throw new Error("The backup's manifest is corrupted; couldn't read it.");
  }
  if (typeof parsed.schemaVersion !== "number") {
    throw new Error("The backup is missing a schema version.");
  }
  if (parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error(
      `This backup was made by a newer version of the app (schema ${parsed.schemaVersion}). Update the app and try again.`,
    );
  }
  return parsed;
}

function parseJson<T>(
  entries: Record<string, Uint8Array>,
  name: string,
  fallback: T,
): T {
  const raw = entries[name];
  if (!raw) return fallback;
  try {
    return JSON.parse(decoder.decode(raw)) as T;
  } catch {
    throw new Error(`Couldn't read ${name} from the backup.`);
  }
}

async function loadLocalCounts(): Promise<BackupPreview["local"]> {
  const [profile, decks, cards, reviews, sessions, media] = await Promise.all([
    db.profile.get("self"),
    db.decks.count(),
    db.cards.count(),
    db.reviews.count(),
    db.sessions.count(),
    db.media.count(),
  ]);
  return {
    profileVersion: profile?.version ?? 0,
    decks,
    cards,
    reviews,
    sessions,
    media,
  };
}
