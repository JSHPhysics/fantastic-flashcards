import { useParams } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function CardEditPage() {
  const { cardId } = useParams();
  return (
    <PagePlaceholder
      title="Edit card"
      subtitle={`Editing card ${cardId ?? "?"}. Type tabs and editors arrive in Sessions 4-9.`}
    />
  );
}
