import { useParams } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function DeckDetailPage() {
  const { id } = useParams();
  return (
    <PagePlaceholder
      title="Deck"
      subtitle={`Detail view for deck ${id ?? "?"}. Card list, Study and Add-card CTAs arrive in Session 3.`}
    />
  );
}
