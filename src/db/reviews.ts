import { db } from "./schema";
import { bumpVersion } from "./profile";
import { newId } from "./ids";
import type { ReviewEvent } from "./types";

export async function addReviewEvent(
  input: Omit<ReviewEvent, "id">,
): Promise<ReviewEvent> {
  const review: ReviewEvent = { id: newId(), ...input };
  await db.reviews.add(review);
  await bumpVersion("review recorded");
  return review;
}

export async function listReviewsForCard(
  cardId: string,
): Promise<ReviewEvent[]> {
  return db.reviews.where("cardId").equals(cardId).toArray();
}

export async function listReviewsForSession(
  sessionId: string,
): Promise<ReviewEvent[]> {
  return db.reviews.where("sessionId").equals(sessionId).toArray();
}

export async function listReviewsSince(timestamp: number): Promise<ReviewEvent[]> {
  return db.reviews
    .where("timestamp")
    .aboveOrEqual(timestamp)
    .toArray();
}
