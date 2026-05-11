// Seven daily bars + an accuracy line overlay. Pure SVG. Tapping a bar
// calls onSelectDay so the Stats page can drill into that day's sessions.

import type { WeekStats } from "../../study/statsAggregator";

interface WeekChartProps {
  week: WeekStats;
  onSelectDay?: (date: string) => void;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekChart({ week, onSelectDay }: WeekChartProps) {
  const width = 560;
  const height = 220;
  const padLeft = 28;
  const padRight = 28;
  const padTop = 16;
  const padBottom = 30;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const slot = chartWidth / week.days.length;
  const maxCards = Math.max(1, ...week.days.map((d) => d.cards));

  // y for "0 cards" sits at the chart bottom; y for max cards sits at top.
  const y = (cards: number) =>
    padTop + chartHeight - (cards / maxCards) * chartHeight;
  const yAccuracy = (accuracy: number) =>
    padTop + chartHeight - (accuracy / 100) * chartHeight;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full max-w-2xl"
        role="img"
        aria-label="Cards per day this week, with accuracy line"
      >
        {/* Y-axis ticks for cards count */}
        {[0, 0.5, 1].map((frac) => {
          const ty = padTop + chartHeight - frac * chartHeight;
          return (
            <g key={frac}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={ty}
                y2={ty}
                stroke="currentColor"
                strokeOpacity={0.1}
              />
              <text
                x={padLeft - 6}
                y={ty}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-current opacity-60"
                style={{ fontSize: 11 }}
              >
                {Math.round(maxCards * frac)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {week.days.map((day, idx) => {
          const date = new Date(`${day.date}T00:00:00`);
          const dayOfWeek = date.getDay();
          const barTop = y(day.cards);
          const barBottom = padTop + chartHeight;
          const barX = padLeft + idx * slot + slot * 0.18;
          const barWidth = slot * 0.64;
          return (
            <g key={day.date}>
              <rect
                x={barX}
                y={barTop}
                width={barWidth}
                height={Math.max(0, barBottom - barTop)}
                rx={4}
                fill="currentColor"
                fillOpacity={day.cards > 0 ? 0.4 : 0.08}
                onClick={onSelectDay ? () => onSelectDay(day.date) : undefined}
                style={{ cursor: onSelectDay && day.cards > 0 ? "pointer" : "default" }}
              />
              {day.cards > 0 && (
                <text
                  x={barX + barWidth / 2}
                  y={barTop - 4}
                  textAnchor="middle"
                  className="fill-current"
                  style={{ fontSize: 11, fontWeight: 600 }}
                >
                  {day.cards}
                </text>
              )}
              <text
                x={barX + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                className="fill-current opacity-70"
                style={{ fontSize: 11 }}
              >
                {DAY_LABELS[dayOfWeek]}
              </text>
            </g>
          );
        })}

        {/* Accuracy line (only where there are reviews) */}
        <path
          d={buildAccuracyPath(week, padLeft, slot, yAccuracy)}
          fill="none"
          stroke="#C9A14A"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {week.days.map((day, idx) => {
          if (day.cards === 0) return null;
          const cx = padLeft + idx * slot + slot / 2;
          const cy = yAccuracy(day.accuracy);
          return (
            <g key={`pt-${day.date}`}>
              <circle cx={cx} cy={cy} r={4.5} fill="#C9A14A" />
              <text
                x={cx + 8}
                y={cy - 6}
                className="fill-current opacity-70"
                style={{ fontSize: 10 }}
              >
                {day.accuracy}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function buildAccuracyPath(
  week: WeekStats,
  padLeft: number,
  slot: number,
  yFn: (accuracy: number) => number,
): string {
  const points: string[] = [];
  for (let i = 0; i < week.days.length; i += 1) {
    const day = week.days[i];
    if (day.cards === 0) continue;
    const cx = padLeft + i * slot + slot / 2;
    const cy = yFn(day.accuracy);
    points.push(`${points.length === 0 ? "M" : "L"} ${cx} ${cy}`);
  }
  return points.join(" ");
}
