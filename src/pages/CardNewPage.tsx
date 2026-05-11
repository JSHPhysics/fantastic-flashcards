import { useSearchParams } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function CardNewPage() {
  const [params] = useSearchParams();
  const deckId = params.get("deckId");
  const type = params.get("type") ?? "basic";
  return (
    <PagePlaceholder
      title="New card"
      subtitle={`Type "${type}"${deckId ? ` in deck ${deckId}` : ""}. Authoring flows arrive in Sessions 4-9.`}
    />
  );
}
