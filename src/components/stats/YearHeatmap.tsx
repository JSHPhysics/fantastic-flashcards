// GitHub-style heatmap of review counts across the last 53 weeks. Pure SVG.
// Intensity is 0-4: 0 (no reviews), 1-4 (busier).

import type { YearHeatmap } from "../../study/statsAggregator";

interface YearHeatmapProps {
  data: YearHeatmap;
  onSelectDay?: (date: string) => void;
}

// Quartiles of the non-zero max count, so a heavy-review user's chart still
// distinguishes between busy and lighter days.
function intensityFor(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

const INTENSITY_FILL = [
  "rgba(30,58,95,0.08)", // 0
  "rgba(30,58,95,0.22)", // 1
  "rgba(30,58,95,0.42)", // 2
  "rgba(30,58,95,0.66)", // 3
  "rgba(30,58,95,0.92)", // 4
];

export function YearHeatmap({ data, onSelectDay }: YearHeatmapProps) {
  // 16px cells with 3px gaps render at a proper finger tap target on iPad
  // (visible square ~16px wide instead of the ~8px we got at viewBox-scaled
  // 12px). The chart scrolls horizontally if it overflows; that's preferable
  // to micro-cells nobody can hit accurately.
  const cell = 16;
  const gap = 3;
  const cols = data.weeksShown;
  const monthLabels = computeMonthLabels(data);

  const labelHeight = 14;
  const rowLabelWidth = 26;
  const width = rowLabelWidth + cols * (cell + gap);
  const height = labelHeight + 7 * (cell + gap);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        // Native pixel sizing — no viewBox scaling — so each cell renders at
        // its full px width regardless of how wide the container is. The
        // outer div handles horizontal scroll on narrow viewports.
        width={width}
        height={height}
        className="block"
        role="img"
        aria-label={`${data.totalReviews} reviews across ${data.daysActive} days in the last 53 weeks`}
      >
        {/* Month labels along the top */}
        {monthLabels.map((m) => (
          <text
            key={m.col}
            x={rowLabelWidth + m.col * (cell + gap)}
            y={10}
            className="fill-current opacity-70"
            style={{ fontSize: 10 }}
          >
            {m.label}
          </text>
        ))}

        {/* Day-of-week labels on the left (skip a few for legibility) */}
        {[1, 3, 5].map((row) => (
          <text
            key={row}
            x={rowLabelWidth - 4}
            y={labelHeight + row * (cell + gap) + cell - 2}
            textAnchor="end"
            className="fill-current opacity-70"
            style={{ fontSize: 9 }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row]}
          </text>
        ))}

        {/* Cells */}
        {data.grid.map((row, rowIdx) =>
          row.map((cellData, colIdx) => {
            if (!cellData) return null;
            const x = rowLabelWidth + colIdx * (cell + gap);
            const y = labelHeight + rowIdx * (cell + gap);
            const intensity = intensityFor(cellData.count, data.maxCount);
            const clickable = onSelectDay && cellData.count > 0;
            return (
              <rect
                key={`${rowIdx}-${colIdx}`}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx={2}
                fill={INTENSITY_FILL[intensity]}
                onClick={clickable ? () => onSelectDay(cellData.date) : undefined}
                style={{ cursor: clickable ? "pointer" : "default" }}
              >
                <title>{`${cellData.date}: ${cellData.count} review${cellData.count === 1 ? "" : "s"}`}</title>
              </rect>
            );
          }),
        )}
      </svg>

      <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-500 dark:text-ink-300">
        <span>Less</span>
        {INTENSITY_FILL.map((c, i) => (
          <span
            key={i}
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: c }}
          />
        ))}
        <span>More</span>
        <span className="ml-3">
          {data.daysActive} active day{data.daysActive === 1 ? "" : "s"} · {data.totalReviews} reviews
        </span>
      </div>
    </div>
  );
}

// Computes which columns should get a month-name label (the first column
// whose first day falls in a new month). Picks the first available cell in
// the column so we get a consistent baseline date.
function computeMonthLabels(
  data: YearHeatmap,
): { col: number; label: string }[] {
  const seenMonths = new Set<string>();
  const labels: { col: number; label: string }[] = [];
  for (let col = 0; col < data.weeksShown; col += 1) {
    let cellDate: string | null = null;
    for (let row = 0; row < 7; row += 1) {
      if (data.grid[row][col]) {
        cellDate = data.grid[row][col]!.date;
        break;
      }
    }
    if (!cellDate) continue;
    const month = cellDate.slice(0, 7); // YYYY-MM
    if (seenMonths.has(month)) continue;
    seenMonths.add(month);
    const [_, m] = cellDate.split("-").map(Number);
    if (m !== undefined) {
      labels.push({
        col,
        label: new Date(2000, m - 1, 1).toLocaleString(undefined, {
          month: "short",
        }),
      });
    }
  }
  return labels;
}
