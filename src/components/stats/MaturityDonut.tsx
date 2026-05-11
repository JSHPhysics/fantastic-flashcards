// Three-segment donut showing the new / learning / mature breakdown for a
// deck. Pure SVG. Hidden when the deck is empty.
//
// Segments use the rating colour palette so they're visually distinct from
// the accuracy ring (which is a single-tone donut).

import type { DeckMaturity } from "../../study/statsAggregator";

interface MaturityDonutProps {
  stats: DeckMaturity;
  size?: number;
}

export function MaturityDonut({ stats, size = 140 }: MaturityDonutProps) {
  const total = stats.newCount + stats.learningCount + stats.matureCount;
  if (total === 0) return null;

  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = [
    { label: "Mature", count: stats.matureCount, color: "#3E8E63" },
    { label: "Learning", count: stats.learningCount, color: "#D4912E" },
    { label: "New", count: stats.newCount, color: "#3D7AB8" },
  ];

  // Compose dasharrays by stacking offsets around the circle.
  let cumulative = 0;
  const segmentPaths = segments.map((seg) => {
    const portion = seg.count / total;
    const length = circumference * portion;
    const dashArray = `${length} ${circumference - length}`;
    const dashOffset = -cumulative;
    cumulative += length;
    return { ...seg, dashArray, dashOffset, portion };
  });

  return (
    <div className="inline-flex items-center gap-4">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Maturity: ${stats.matureCount} mature, ${stats.learningCount} learning, ${stats.newCount} new`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={strokeWidth}
        />
        {segmentPaths.map((s) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ))}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current"
          style={{ fontSize: size * 0.18, fontWeight: 600 }}
        >
          {total}
        </text>
      </svg>
      <ul className="space-y-1 text-xs">
        {segmentPaths.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="font-medium text-ink-900 dark:text-dark-ink">
              {s.count}
            </span>
            <span className="text-ink-500 dark:text-ink-300">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
