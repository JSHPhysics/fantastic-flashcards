import { useParams } from "react-router-dom";
import { CardEditor } from "../components/cards/CardEditor";

export function CardEditPage() {
  const { cardId } = useParams();
  if (!cardId) return null;
  return <CardEditor cardId={cardId} />;
}
