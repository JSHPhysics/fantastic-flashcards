import { db } from "./schema";
import { bumpVersion } from "./profile";
import type { Session } from "./types";

export async function recordSession(session: Session): Promise<void> {
  await db.sessions.add(session);
  await bumpVersion("session recorded");
}

export async function listRecentSessions(limit = 50): Promise<Session[]> {
  return db.sessions.orderBy("startedAt").reverse().limit(limit).toArray();
}

export async function listSessionsInRange(
  fromTimestamp: number,
  toTimestamp: number,
): Promise<Session[]> {
  return db.sessions
    .where("startedAt")
    .between(fromTimestamp, toTimestamp, true, true)
    .toArray();
}
