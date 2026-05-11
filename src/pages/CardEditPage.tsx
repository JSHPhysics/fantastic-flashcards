import { lazy, Suspense } from "react";
import { useParams } from "react-router-dom";
import { CardEditor } from "../components/cards/CardEditor";
import { useCard } from "../db";

// Konva is heavy; lazy-load the occlusion editor so editing a Basic / Cloze
// card doesn't pull it in.
const OcclusionEditor = lazy(
  () => import("../components/cards/occlusion/OcclusionEditor"),
);

export function CardEditPage() {
  const { cardId } = useParams();
  const card = useCard(cardId);
  if (!cardId) return null;
  // Wait until the card has loaded so we can route the right editor.
  if (card === undefined) {
    return (
      <div className="mt-8 text-center text-sm text-ink-500">
        Loading the card...
      </div>
    );
  }
  if (card && card.type === "occlusion") {
    return (
      <Suspense
        fallback={
          <div className="mt-8 text-center text-sm text-ink-500">
            Loading the image-occlusion editor...
          </div>
        }
      >
        <OcclusionEditor cardId={cardId} />
      </Suspense>
    );
  }
  return <CardEditor cardId={cardId} />;
}
