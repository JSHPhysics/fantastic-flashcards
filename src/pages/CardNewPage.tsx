import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { CardEditor } from "../components/cards/CardEditor";
import type { CardType } from "../db";

const ALLOWED: CardType[] = ["basic", "cloze", "mcq", "typed", "occlusion", "drawing"];

// Konva is heavy (~150 KB); lazy-load the occlusion editor so visiting any
// other card type keeps the main bundle small.
const OcclusionEditor = lazy(
  () => import("../components/cards/occlusion/OcclusionEditor"),
);

export function CardNewPage() {
  const [params] = useSearchParams();
  const deckId = params.get("deckId") ?? undefined;
  const typeParam = params.get("type");
  const type = (ALLOWED as string[]).includes(typeParam ?? "")
    ? (typeParam as CardType)
    : "basic";

  if (type === "occlusion") {
    return (
      <Suspense fallback={<EditorFallback />}>
        <OcclusionEditor initialDeckId={deckId} />
      </Suspense>
    );
  }

  return <CardEditor initialDeckId={deckId} initialType={type} />;
}

function EditorFallback() {
  return (
    <div className="mt-8 text-center text-sm text-ink-500">
      Loading the image-occlusion editor...
    </div>
  );
}
