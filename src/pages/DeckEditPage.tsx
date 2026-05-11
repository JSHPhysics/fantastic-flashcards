import { useParams } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function DeckEditPage() {
  const { id } = useParams();
  return (
    <PagePlaceholder
      title="Edit deck"
      subtitle={`Editing deck ${id ?? "?"}. Form arrives in Session 3.`}
    />
  );
}
