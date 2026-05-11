import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { CardEditor } from "../components/cards/CardEditor";
import type { CardType } from "../db";

const ALLOWED: CardType[] = ["basic", "cloze", "mcq", "typed", "occlusion", "drawing"];

// Konva is heavy (~150 KB); lazy-load the canvas-based editors so visiting
// any text-card type keeps the main bundle small. Both occlusion and
// drawing pull from the same Konva chunk because vite's chunking
// deduplicates the shared dependency.
const OcclusionEditor = lazy(
  () => import("../components/cards/occlusion/OcclusionEditor"),
);
const DrawingEditor = lazy(
  () => import("../components/cards/drawing/DrawingEditor"),
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
      <Suspense fallback={<EditorFallback label="image-occlusion" />}>
        <OcclusionEditor initialDeckId={deckId} />
      </Suspense>
    );
  }
  if (type === "drawing") {
    return (
      <Suspense fallback={<EditorFallback label="drawing" />}>
        <DrawingEditor initialDeckId={deckId} />
      </Suspense>
    );
  }

  return <CardEditor initialDeckId={deckId} initialType={type} />;
}

function EditorFallback({ label }: { label: string }) {
  return (
    <div className="mt-8 text-center text-sm text-ink-500">
      Loading the {label} editor...
    </div>
  );
}
