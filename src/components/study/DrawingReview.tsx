// Drawing review with a student-drawn canvas overlaid on the prompt
// background. Once the student taps "Show model answer", the model is
// revealed in the deck's chosen mode: overlay (model on top of the student
// drawing), side-by-side (mirror view), or toggle (tap a button to flip
// between the two).
//
// The student's strokes live only in component state — they're never
// persisted (per Playbook §7 "Drawing card: drawing discarded after
// rating"). On rate, the parent unmounts the component, which clears state.

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import type Konva from "konva";
import type { DrawingContent, Rating } from "../../db";
import { useObjectUrl } from "../../media/useObjectUrl";
import { DrawingRenderer } from "../cards/drawing/DrawingRenderer";
import { RichFieldRender } from "../media/RichFieldPreview";
import { RatingButtons } from "./RatingButtons";
import { Button } from "../Button";
import { newId } from "../../db/ids";

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 480;
const MAX_DISPLAY_WIDTH = 900;
const PEN_COLOURS = ["#1E3A5F", "#C44545", "#3E8E63", "#C9A14A"];

interface DrawingReviewProps {
  content: DrawingContent;
  onRate: (rating: Rating) => void;
}

interface Stroke {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  points: number[]; // flat [x0, y0, x1, y1, ...]
}

export function DrawingReview({ content, onRate }: DrawingReviewProps) {
  const [revealed, setRevealed] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(PEN_COLOURS[0]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);
  // For the "toggle" reveal mode: which view the student is currently
  // looking at — their own drawing or the model.
  const [toggleView, setToggleView] = useState<"mine" | "model">("mine");

  const backgroundUrl = useObjectUrl(content.backgroundImageHash);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });

  const stageRef = useRef<Konva.Stage | null>(null);

  // Size the canvas to the background image (if any) so the student's
  // strokes line up with whatever diagram they're drawing onto.
  useEffect(() => {
    if (!backgroundUrl) {
      setBgImage(null);
      setCanvasSize({
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
      });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const displayWidth = Math.min(MAX_DISPLAY_WIDTH, img.naturalWidth);
      const scale = displayWidth / img.naturalWidth;
      setCanvasSize({
        width: displayWidth,
        height: Math.round(img.naturalHeight * scale),
      });
      setBgImage(img);
    };
    img.src = backgroundUrl;
  }, [backgroundUrl]);

  // Reset student strokes whenever the card changes (parent already remounts
  // via key={card.id} in CardReviewer, but this guards against accidental
  // re-use).
  useEffect(() => {
    setStrokes([]);
    setActiveStroke(null);
    setRevealed(false);
  }, [content.modelAnswerImageHash, content.backgroundImageHash]);

  // ---- pointer handlers ----

  const handlePointerDown = (
    e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
  ) => {
    if (revealed) return; // freeze the canvas once the model is up
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    e.evt?.preventDefault?.();
    setActiveStroke({
      id: newId(),
      tool,
      color,
      width: tool === "eraser" ? 16 : 3,
      points: [pos.x, pos.y],
    });
  };

  const handlePointerMove = (
    e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
  ) => {
    if (!activeStroke) return;
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    e.evt?.preventDefault?.();
    setActiveStroke({
      ...activeStroke,
      points: [...activeStroke.points, pos.x, pos.y],
    });
  };

  const handlePointerUp = () => {
    if (!activeStroke) return;
    if (activeStroke.points.length >= 4) {
      setStrokes((prev) => [...prev, activeStroke]);
    }
    setActiveStroke(null);
  };

  const clearAll = () => {
    setStrokes([]);
    setActiveStroke(null);
  };

  const showModel = () => {
    setRevealed(true);
    // In toggle mode, default to looking at the model first — that's what
    // they asked to see.
    if (content.revealMode === "toggle") setToggleView("model");
  };

  // The student-canvas (Konva stage), rendered as a transparent overlay so
  // strokes sit on top of the background image (if any).
  const studentCanvas = useMemo(
    () => (
      <Stage
        ref={stageRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          touchAction: "none",
          cursor: revealed ? "default" : tool === "eraser" ? "crosshair" : "crosshair",
        }}
      >
        <Layer listening={false}>
          {bgImage && (
            <KonvaImage
              image={bgImage}
              x={0}
              y={0}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          )}
        </Layer>
        <Layer>
          {strokes.map((s) => (
            <Line
              key={s.id}
              points={s.points}
              stroke={s.color}
              strokeWidth={s.width}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                s.tool === "eraser" ? "destination-out" : "source-over"
              }
            />
          ))}
          {activeStroke && (
            <Line
              points={activeStroke.points}
              stroke={activeStroke.color}
              strokeWidth={activeStroke.width}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                activeStroke.tool === "eraser" ? "destination-out" : "source-over"
              }
            />
          )}
        </Layer>
      </Stage>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [strokes, activeStroke, bgImage, canvasSize, tool, revealed],
  );

  return (
    <div className="space-y-4">
      <div className="card-surface p-6">
        <p className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-300">
          Draw your answer
        </p>
        <div className="mt-2 text-card-body">
          <RichFieldRender field={content.prompt} />
        </div>
      </div>

      {!revealed && <DrawingToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} onClear={clearAll} />}

      {/* Layout switches based on reveal mode. Before reveal we always show
          just the student canvas. After reveal:
            overlay     — model rendered on top of student strokes.
            side-by-side — student left, model right (stacked on small screens).
            toggle      — one-or-the-other, with a "Swap view" button. */}
      <div className="flex flex-wrap justify-center gap-4">
        {revealed && content.revealMode === "side-by-side" ? (
          <>
            <div>
              <p className="mb-1 text-xs text-ink-500 dark:text-ink-300">
                Your drawing
              </p>
              <div className="rounded-2xl border border-ink-100 bg-surface dark:border-dark-surface dark:bg-dark-bg">
                {studentCanvas}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-500 dark:text-ink-300">
                Model answer
              </p>
              <DrawingRenderer content={content} showModel={true} />
            </div>
          </>
        ) : revealed && content.revealMode === "overlay" ? (
          <DrawingRenderer
            content={content}
            showModel={true}
            emptyOverlay={studentCanvas}
          />
        ) : revealed && content.revealMode === "toggle" ? (
          <div className="flex flex-col items-center gap-2">
            {toggleView === "mine" ? (
              <div className="rounded-2xl border border-ink-100 bg-surface dark:border-dark-surface dark:bg-dark-bg">
                {studentCanvas}
              </div>
            ) : (
              <DrawingRenderer content={content} showModel={true} />
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setToggleView((v) => (v === "mine" ? "model" : "mine"))
              }
            >
              Show {toggleView === "mine" ? "model answer" : "my drawing"}
            </Button>
          </div>
        ) : (
          // Pre-reveal: just the student canvas.
          <div className="rounded-2xl border border-ink-100 bg-surface dark:border-dark-surface dark:bg-dark-bg">
            {studentCanvas}
          </div>
        )}
      </div>

      {revealed ? (
        <RatingButtons onRate={onRate} />
      ) : (
        <div className="flex justify-center">
          <Button onClick={showModel}>Show model answer</Button>
        </div>
      )}
    </div>
  );
}

function DrawingToolbar({
  tool,
  setTool,
  color,
  setColor,
  onClear,
}: {
  tool: "pen" | "eraser";
  setTool: (t: "pen" | "eraser") => void;
  color: string;
  setColor: (c: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => setTool("pen")}
        aria-pressed={tool === "pen"}
        className={`tap-target rounded-full px-4 text-sm font-semibold ${
          tool === "pen"
            ? "bg-navy text-cream"
            : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
        }`}
      >
        Pen
      </button>
      <button
        type="button"
        onClick={() => setTool("eraser")}
        aria-pressed={tool === "eraser"}
        className={`tap-target rounded-full px-4 text-sm font-semibold ${
          tool === "eraser"
            ? "bg-navy text-cream"
            : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
        }`}
      >
        Eraser
      </button>
      <div className="flex items-center gap-1">
        {PEN_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Pen colour ${c}`}
            onClick={() => {
              setColor(c);
              setTool("pen");
            }}
            className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition-all ${
              color === c
                ? "ring-navy dark:ring-gold"
                : "ring-transparent hover:ring-ink-300"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
