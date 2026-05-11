import { db } from "./schema";
import type { MediaBlob } from "./types";

// Hash-keyed media table with refCount. Session 6 builds the import / encode
// pipeline on top of this; for now these are the primitives.

export async function getMedia(hash: string): Promise<MediaBlob | undefined> {
  return db.media.get(hash);
}

// Insert if missing, otherwise increment refCount.
export async function storeMedia(input: {
  hash: string;
  blob: Blob;
  mimeType: string;
  bytes: number;
}): Promise<void> {
  await db.transaction("rw", db.media, async () => {
    const existing = await db.media.get(input.hash);
    if (existing) {
      await db.media.update(input.hash, { refCount: existing.refCount + 1 });
      return;
    }
    const row: MediaBlob = {
      hash: input.hash,
      blob: input.blob,
      mimeType: input.mimeType,
      bytes: input.bytes,
      refCount: 1,
      createdAt: Date.now(),
    };
    await db.media.add(row);
  });
}

export async function retainMedia(hash: string): Promise<void> {
  await db.transaction("rw", db.media, async () => {
    const m = await db.media.get(hash);
    if (m) await db.media.update(hash, { refCount: m.refCount + 1 });
  });
}

export async function releaseMedia(hash: string): Promise<void> {
  await db.transaction("rw", db.media, async () => {
    const m = await db.media.get(hash);
    if (!m) return;
    await db.media.update(hash, { refCount: Math.max(0, m.refCount - 1) });
  });
}

// Sweep media rows with no remaining references. Runs on profile load.
export async function sweepOrphanedMedia(): Promise<number> {
  const orphans = (await db.media
    .where("refCount")
    .belowOrEqual(0)
    .primaryKeys()) as string[];
  if (orphans.length) await db.media.bulkDelete(orphans);
  return orphans.length;
}

export async function totalMediaBytes(): Promise<number> {
  let total = 0;
  await db.media.each((m) => {
    total += m.bytes;
  });
  return total;
}
