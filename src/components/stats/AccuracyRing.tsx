// Donut showing accuracy as a percentage of a full ring. Pure SVG.

interface AccuracyRingProps {
  accuracy: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function AccuracyRing({
  accuracy,
  size = 140,
  strokeWidth = 14,
  label,
}: AccuracyRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, accuracy));
  const filled = (circumference * clamped) / 100;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="inline-flex flex-col items-center">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`Accuracy: ${clamped}%`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          // Start from the top of the ring rather than 3 o'clock.
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 250ms" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-current"
          style={{ fontSize: size * 0.24, fontWeight: 600 }}
        >
          {clamped}%
        </text>
      </svg>
      {label && (
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-300">{label}</p>
      )}
    </div>
  );
}
