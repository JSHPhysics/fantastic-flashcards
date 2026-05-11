// Pure-SVG renderer for an occlusion card. Used both by the deck-detail
// preview ("revealed" mode for thumbnails) and at review time (Session 10
// will wire it in). No Konva here - this is read-only display, and SVG is
// cheaper for static shapes than a full Konva Stage.
//
// Geometries are stored as normalised 0-1 coordinates (RectGeom, EllipseGeom,
// PolygonGeom). We convert them to pixel coordinates at render time using
// the loaded image's intrinsic dimensions, so a single set of masks
// renders correctly at any display size.

import { useEffect, useState } from "react";
import { useObjectUrl } from "../../../media/useObjectUrl";
import type {
  EllipseGeom,
  OcclusionContent,
  OcclusionMask,
  PolygonGeom,
  RectGeom,
} from "../../../db";

interface OcclusionRendererProps {
  content: OcclusionContent;
  // "hidden": active masks covered (initial review state).
  // "revealed": all masks visible (after the user reveals the answer).
  state: "hidden" | "revealed";
  // Optional click handler invoked when the user taps anywhere on the figure.
  // The review flow uses this as "Show Answer".
  onReveal?: () => void;
}

export function OcclusionRenderer({
  content,
  state,
  onReveal,
}: OcclusionRendererProps) {
  const url = useObjectUrl(content.imageHash);
  const dims = useImageDimensions(url);

  if (!url) {
    return (
      <div className="card-surface flex h-48 items-center justify-center text-sm text-ink-500">
        Loading image...
      </div>
    );
  }
  if (!dims) {
    // First paint: render the image so dimensions resolve. Masks layer in
    // the next frame once we know the natural size.
    return (
      <div className="relative">
        <img src={url} alt="" className="block max-h-[70vh] w-auto" />
      </div>
    );
  }

  const { width: w, height: h } = dims;
  // Which mask ids are "active" for this card. In hide-one mode it's just
  // the activeMaskId (and any siblings sharing its groupId). In hide-all
  // mode it's every mask.
  const activeIds = activeMaskIdSetForCard(content);

  return (
    <div
      className="relative inline-block cursor-pointer select-none"
      onClick={onReveal}
      role={onReveal ? "button" : undefined}
      aria-label={onReveal ? "Show answer" : undefined}
    >
      <img
        src={url}
        alt=""
        className="block max-h-[70vh] w-auto"
        draggable={false}
      />
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        {content.masks.map((mask) => (
          <MaskShape
            key={mask.id}
            mask={mask}
            imageWidth={w}
            imageHeight={h}
            visible={
              state === "hidden" ? activeIds.has(mask.id) : false
            }
          />
        ))}
      </svg>
    </div>
  );
}

function activeMaskIdSetForCard(content: OcclusionContent): Set<string> {
  if (content.mode === "hide-all") {
    return new Set(content.masks.map((m) => m.id));
  }
  // hide-one: cover the active mask, plus every mask in its group.
  const active = content.masks.find((m) => m.id === content.activeMaskId);
  if (!active) return new Set();
  if (!active.groupId) return new Set([active.id]);
  const group = content.masks
    .filter((m) => m.groupId === active.groupId)
    .map((m) => m.id);
  return new Set(group);
}

function MaskShape({
  mask,
  imageWidth,
  imageHeight,
  visible,
}: {
  mask: OcclusionMask;
  imageWidth: number;
  imageHeight: number;
  visible: boolean;
}) {
  // 200ms fade in/out so a tap-to-reveal feels intentional.
  const baseProps = {
    style: {
      transition: "opacity 200ms",
      opacity: visible ? 1 : 0,
    },
    fill: "#1E3A5F",
    stroke: "#0F1E33",
    strokeWidth: 1,
  };
  if (mask.shape === "rect") {
    const g = mask.geometry as RectGeom;
    return (
      <rect
        x={g.x * imageWidth}
        y={g.y * imageHeight}
        width={g.w * imageWidth}
        height={g.h * imageHeight}
        rx={6}
        {...baseProps}
      />
    );
  }
  if (mask.shape === "ellipse") {
    const g = mask.geometry as EllipseGeom;
    return (
      <ellipse
        cx={g.cx * imageWidth}
        cy={g.cy * imageHeight}
        rx={g.rx * imageWidth}
        ry={g.ry * imageHeight}
        {...baseProps}
      />
    );
  }
  const g = mask.geometry as PolygonGeom;
  const points = g.points
    .map(([x, y]) => `${x * imageWidth},${y * imageHeight}`)
    .join(" ");
  return <polygon points={points} {...baseProps} />;
}

// Read the image's natural dimensions once it loads. The renderer uses the
// dimensions to translate normalised mask coordinates into pixels for SVG.
function useImageDimensions(
  url: string | null,
): { width: number; height: number } | null {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    if (!url) {
      setDims(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return dims;
}
