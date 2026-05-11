// Per-deck media-size chip: green <20MB, amber 20-100MB, red >100MB.
// Session 6 wires up the real mediaBytes accounting; for now this just reads
// the stored value (always 0 until media is added).

const MB = 1024 * 1024;

export function DeckSizeChip({ bytes }: { bytes: number }) {
  if (bytes === 0) return null;
  const mb = bytes / MB;
  let className = "bg-good/15 text-good";
  const label = `${mb.toFixed(1)} MB`;
  if (bytes > 100 * MB) {
    className = "bg-again/15 text-again";
  } else if (bytes > 20 * MB) {
    className = "bg-hard/15 text-hard";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      aria-label={`Media size ${label}`}
    >
      {label}
    </span>
  );
}
