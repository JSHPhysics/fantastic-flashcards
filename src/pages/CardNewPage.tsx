import { useSearchParams } from "react-router-dom";
import { CardEditor } from "../components/cards/CardEditor";
import type { CardType } from "../db";

const ALLOWED: CardType[] = ["basic", "cloze", "mcq", "typed", "occlusion", "drawing"];

export function CardNewPage() {
  const [params] = useSearchParams();
  const deckId = params.get("deckId") ?? undefined;
  const typeParam = params.get("type");
  const type = (ALLOWED as string[]).includes(typeParam ?? "")
    ? (typeParam as CardType)
    : "basic";
  return <CardEditor initialDeckId={deckId} initialType={type} />;
}
