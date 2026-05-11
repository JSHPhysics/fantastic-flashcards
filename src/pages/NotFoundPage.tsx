import { Link } from "react-router-dom";
import { PagePlaceholder } from "./PagePlaceholder";

export function NotFoundPage() {
  return (
    <PagePlaceholder
      title="Page not found"
      subtitle="That route doesn't exist yet."
    >
      <Link
        to="/"
        className="tap-target inline-flex items-center justify-center rounded-xl bg-navy px-5 text-sm font-semibold text-cream"
      >
        Back to home
      </Link>
    </PagePlaceholder>
  );
}
