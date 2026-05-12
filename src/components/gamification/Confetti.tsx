// Lightweight CSS-only confetti. No library, no canvas — each piece is an
// absolutely-positioned div with a randomised colour + drift animation.
//
// Three intensities map to the spec's rank-up bands:
//  - subtle (Recruit through Master): 40 pieces, brand palette
//  - bold (Grandmaster, Elite): 80 pieces, brand palette
//  - legend (Legend): 140 pieces, gold-only
//
// Respects prefers-reduced-motion: if the user has reduced motion on, we
// skip the animation entirely (animation-duration globally clamped in
// index.css). Effectively the confetti pieces appear and immediately fall
// off, which keeps the celebration low-impact.

import { useMemo } from "react";

interface ConfettiProps {
  intensity: 1 | 2 | 3;
}

const SUBTLE_COLOURS = [
  "#1E3A5F",
  "#C9A14A",
  "#3D7AB8",
  "#3E8E63",
  "#C44545",
  "#D4912E",
];
const LEGEND_COLOURS = ["#C9A14A", "#E2B95E", "#F5D58A", "#B58739"];

function intensityToCount(i: 1 | 2 | 3): number {
  return i === 1 ? 40 : i === 2 ? 80 : 140;
}

export function Confetti({ intensity }: ConfettiProps) {
  // useMemo so the pieces don't rerandomise on every render (e.g. when the
  // parent dialog passes a new prop). Deterministic per-mount.
  const pieces = useMemo(() => {
    const count = intensityToCount(intensity);
    const palette = intensity === 3 ? LEGEND_COLOURS : SUBTLE_COLOURS;
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100; // %
      const delay = Math.random() * 0.6; // s
      const duration = 2.4 + Math.random() * 1.2; // s
      const colour = palette[i % palette.length];
      const size = 6 + Math.random() * 6; // px
      const rotate = Math.random() * 360;
      return { left, delay, duration, colour, size, rotate, id: i };
    });
  }, [intensity]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: "-20px",
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 0.5}px`,
            backgroundColor: p.colour,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: "1px",
            animation: `ff-confetti-fall ${p.duration}s ${p.delay}s linear forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes ff-confetti-fall {
          0% { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translate3d(0, 110vh, 0) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
