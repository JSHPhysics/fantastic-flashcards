import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KonvaImage, Line } from "react-konva";
import type Konva from "konva";
import {
  storeMedia,
  useDecks,
  useCard,
  type RichField,
} from "../../../db";
import { newId } from "../../../db/ids";
import { compressImage } from "../../../media/image";
import { useObjectUrl } from "../../../media/useObjectUrl";
import {
  createDrawingCard,
  updateDrawingCard,
  dataUrlToBlob,
} from "../../../cards/drawing";
import { Button } from "../../Button";
import { TagsInput } from "../../TagsInput";
import { FormField, inputClass } from "../../FormField";
import { ImageSourceDialog } from "../../media/ImageSourceDialog";
import { CameraCaptureDialog } from "../../media/CameraCaptureDialog";
import { isCameraSupported } from "../../../media/camera";
import { RichFieldEditor } from "../../media/RichFieldEditor";

// Drawing-card authoring screen. The user types a prompt and draws a model
// answer on a Konva canvas (optionally over an imported background diagram).
// On save the canvas is rendered to a WebP blob and stored once; only the
// hash is kept on the card.
//
// At review time (Session 10) the student draws their own answer on a blank
// canvas and reveals the model via the chosen revealMode.

const MAX_DISPLAY_WIDTH = 900;
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 480;

interface DrawingEditorProps {
  initialDeckId?: string;
  cardId?: string;
}

interface Stroke {
  id: string;
  tool: "pen" | "eraser";
  color: string;
  width: number;
  // Flat [x0, y0, x1, y1, ...] for Konva.Line.
  points: number[];
}

const PEN_COLORS = ["#1E3A5F", "#C44545", "#3E8E63", "#C9A14A"];

function DrawingEditor({ initialDeckId, cardId }: DrawingEditorProps) {
  const navigate = useNavigate();
  const decks = useDecks();
  const editingCard = useCard(cardId);
  const editing = Boolean(cardId);

  const [deckId, setDeckId] = useState<string | undefined>(initialDeckId);
  const [tags, setTags] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<RichField>({ text: "" });
  const [backgroundImageHash, setBackgroundImageHash] = useState<
    string | undefined
  >();
  const [revealMode, setRevealMode] =
    useState<"overlay" | "side-by-side" | "toggle">("toggle");

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(PEN_COLORS[0]);
  const [penWidth, setPenWidth] = useState(3);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<Stroke | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);

  const [stageSize, setStageSize] = useState({
    width: DEFAULT_CANVAS_WIDTH,
    height: DEFAULT_CANVAS_HEIGHT,
  });
  const stageRef = useRef<Konva.Stage | null>(null);
  const strokesLayerRef = useRef<Konva.Layer | null>(null);

  const backgroundUrl = useObjectUrl(backgroundImageHash);
  const [konvaBackground, setKonvaBackground] = useState<HTMLImageElement | null>(
    null,
  );

  // Load existing card content when editing.
  useEffect(() => {
    if (!editing || !editingCard || editingCard.content.type !== "drawing") {
      return;
    }
    const c = editingCard.content;
    setDeckId(editingCard.deckId);
    setTags(editingCard.tags);
    setPrompt(c.prompt);
    setBackgroundImageHash(c.backgroundImageHash);
    setRevealMode(c.revealMode);
    // We don't re-load the existing strokes because we saved the model
    // answer as a flat image, not as vector strokes. Editing therefore
    // re-draws from scratch (or uploads a replacement image, see below).
  }, [editing, editingCard]);

  // Load background image element + adjust stage size to match.
  useEffect(() => {
    if (!backgroundUrl) {
      setKonvaBackground(null);
      // Reset to default canvas size when background cleared.
      setStageSize({
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
      });
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const displayWidth = Math.min(MAX_DISPLAY_WIDTH, img.naturalWidth);
      const scale = displayWidth / img.naturalWidth;
      setStageSize({
        width: displayWidth,
        height: Math.round(img.naturalHeight * scale),
      });
      setKonvaBackground(img);
    };
    img.src = backgroundUrl;
  }, [backgroundUrl]);

  // --- Pointer handlers ---

  const handlePointerDown = (
    e: Konva.KonvaEventObject<PointerEvent | MouseEvent | TouchEvent>,
  ) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    e.evt?.preventDefault?.();

    const nativeEvent = e.evt as PointerEvent | undefined;
    const pressure = nativeEvent?.pressure ?? 0;
    // Map pressure 0..1 to width range; fall back to base width when the
    // event isn't a pen (mouse, fingers, etc. report pressure 0 or 0.5).
    const widthFromPressure =
      pressure > 0 && pressure < 1
        ? Math.max(1.5, penWidth * (0.5 + pressure))
        : penWidth;

    const stroke: Stroke = {
      id: newId(),
      tool,
      color,
      width: widthFromPressure,
      points: [pos.x, pos.y],
    };
    setActiveStroke(stroke);
    setUndoneStrokes([]);
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
    // Drop zero-length strokes (single-tap with no drag).
    if (activeStroke.points.length >= 4) {
      setStrokes((s) => [...s, activeStroke]);
    }
    setActiveStroke(null);
  };

  // --- Tools ---

  const undo = () => {
    if (strokes.length === 0) return;
    setStrokes((s) => {
      const next = s.slice(0, -1);
      setUndoneStrokes((u) => [s[s.length - 1], ...u]);
      return next;
    });
  };

  const redo = () => {
    if (undoneStrokes.length === 0) return;
    setUndoneStrokes((u) => {
      const next = u.slice(1);
      setStrokes((s) => [...s, u[0]]);
      return next;
    });
  };

  const clearAll = () => {
    setStrokes([]);
    setUndoneStrokes([]);
  };

  // --- Background image picker ---

  const handleFile = async (file: File | Blob) => {
    setImporting(true);
    setImportError(null);
    try {
      const compressed = await compressImage(file);
      await storeMedia({
        hash: compressed.hash,
        blob: compressed.blob,
        mimeType: compressed.mimeType,
        bytes: compressed.bytes,
      });
      setBackgroundImageHash(compressed.hash);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Image import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      throw new Error("Clipboard reads aren't supported here. Use the upload option.");
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const t = item.types.find((tp) => tp.startsWith("image/"));
      if (t) {
        const blob = await item.getType(t);
        await handleFile(blob);
        return;
      }
    }
    throw new Error("No image on the clipboard. Take a screenshot first, then try again.");
  };

  // --- Save ---

  const canSave =
    deckId !== undefined &&
    prompt.text.trim().length > 0 &&
    strokes.length > 0;

  const save = async () => {
    if (!canSave || !deckId) return;
    setSaving(true);
    try {
      const stage = stageRef.current;
      if (!stage) throw new Error("Canvas not ready");
      // Capture JUST the strokes layer. The background image is stored
      // separately on the card and re-applied at review time; baking it
      // into the model-answer image would double-render it.
      const dataUrl = strokesLayerRef.current
        ? strokesLayerRef.current.toDataURL({
            mimeType: "image/webp",
            quality: 0.82,
            pixelRatio: 2,
          })
        : stage.toDataURL({
            mimeType: "image/webp",
            quality: 0.82,
            pixelRatio: 2,
          });
      const blob = await dataUrlToBlob(dataUrl);

      if (editing && cardId) {
        await updateDrawingCard(cardId, {
          deckId,
          tags,
          prompt,
          backgroundImageHash,
          modelAnswerBlob: blob,
          revealMode,
        });
      } else {
        await createDrawingCard({
          deckId,
          tags,
          prompt,
          backgroundImageHash,
          modelAnswerBlob: blob,
          revealMode,
        });
      }
      navigate(`/decks/${deckId}`);
    } finally {
      setSaving(false);
    }
  };

  const activeDeck = (decks ?? []).find((d) => d.id === deckId);
  const deckLang = activeDeck?.pronunciationLanguage;

  return (
    <div className="space-y-4">
      <header className="sticky top-14 -mx-4 -mt-4 z-10 border-b border-ink-100 bg-cream/95 px-4 py-3 backdrop-blur dark:border-dark-surface dark:bg-dark-bg/95 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-navy dark:text-gold">
            {editing ? "Edit drawing card" : "New drawing card"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button disabled={!canSave || saving} onClick={save}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Deck" htmlFor="draw-deck">
          <select
            id="draw-deck"
            value={deckId ?? ""}
            onChange={(e) => setDeckId(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select a deck
            </option>
            {(decks ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Tags">
          <TagsInput value={tags} onChange={setTags} />
        </FormField>
      </div>

      <FormField
        label="Prompt"
        hint="What you're asking the student to draw."
      >
        <RichFieldEditor
          value={prompt}
          onChange={setPrompt}
          deckPronunciationLanguage={deckLang}
          rows={2}
        />
      </FormField>

      <div className="card-surface p-4">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          Background image (optional)
        </p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
          Add a picture to draw on top of, like a blank diagram the student
          should label. Leave empty to draw on a clean canvas.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {backgroundImageHash ? (
            <>
              <span className="text-xs text-ink-700 dark:text-ink-300">
                Background added.
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBackgroundImageHash(undefined)}
              >
                Remove
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
              >
                Replace
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setPickerOpen(true)}
              disabled={importing}
            >
              {importing ? "Importing..." : "Add background image"}
            </Button>
          )}
          {importError && (
            <p role="alert" className="text-xs text-again">
              {importError}
            </p>
          )}
        </div>
      </div>

      <div className="card-surface p-4">
        <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
          Draw the model answer
        </p>
        <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
          This is what the student will compare their drawing against.
        </p>

        <PenToolbar
          tool={tool}
          color={color}
          penWidth={penWidth}
          onToolChange={setTool}
          onColorChange={setColor}
          onWidthChange={setPenWidth}
          onUndo={undo}
          onRedo={redo}
          canUndo={strokes.length > 0}
          canRedo={undoneStrokes.length > 0}
          onClear={clearAll}
        />

        <div
          className="mt-3 max-h-[70vh] overflow-auto rounded-lg bg-cream"
          style={{ touchAction: "none" }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <Layer listening={false}>
              {konvaBackground && (
                <KonvaImage
                  image={konvaBackground}
                  width={stageSize.width}
                  height={stageSize.height}
                />
              )}
            </Layer>
            <Layer ref={strokesLayerRef}>
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
                    activeStroke.tool === "eraser"
                      ? "destination-out"
                      : "source-over"
                  }
                />
              )}
            </Layer>
          </Stage>
        </div>
      </div>

      <RevealModePicker mode={revealMode} onChange={setRevealMode} />

      <ImageSourceDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onUploadClick={() => fileInputRef.current?.click()}
        onPasteClick={handlePasteFromClipboard}
        onCameraClick={
          isCameraSupported() ? () => setCameraOpen(true) : undefined
        }
        busyMessage={importing ? "Importing..." : null}
      />
      <CameraCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCaptured={(blob) => void handleFile(blob)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

function PenToolbar({
  tool,
  color,
  penWidth,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
}: {
  tool: "pen" | "eraser";
  color: string;
  penWidth: number;
  onToolChange: (t: "pen" | "eraser") => void;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-ink-100 bg-cream/40 p-2 dark:border-dark-surface dark:bg-dark-bg/40">
      <button
        type="button"
        onClick={() => onToolChange("pen")}
        className={`tap-target rounded-lg px-3 text-xs font-semibold ${
          tool === "pen"
            ? "bg-navy text-cream"
            : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
        }`}
      >
        Pen
      </button>
      <button
        type="button"
        onClick={() => onToolChange("eraser")}
        className={`tap-target rounded-lg px-3 text-xs font-semibold ${
          tool === "eraser"
            ? "bg-navy text-cream"
            : "bg-ink-100 text-ink-700 dark:bg-dark-surface dark:text-ink-300"
        }`}
      >
        Eraser
      </button>
      <span className="mx-1 h-6 w-px bg-ink-200 dark:bg-dark-surface" />
      <span className="text-xs text-ink-500 dark:text-ink-300">Colour:</span>
      {PEN_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Pen colour ${c}`}
          onClick={() => onColorChange(c)}
          disabled={tool !== "pen"}
          className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition-all disabled:opacity-30 ${
            color === c ? "ring-navy" : "ring-transparent hover:ring-ink-300"
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <span className="mx-1 h-6 w-px bg-ink-200 dark:bg-dark-surface" />
      <span className="text-xs text-ink-500 dark:text-ink-300">Size:</span>
      <input
        type="range"
        min={2}
        max={12}
        step={1}
        value={penWidth}
        onChange={(e) => onWidthChange(Number(e.target.value))}
        className="h-6 w-20"
      />
      <span className="mx-1 h-6 w-px bg-ink-200 dark:bg-dark-surface" />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className="tap-target rounded-lg px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-30 dark:text-ink-300 dark:hover:bg-dark-surface"
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className="tap-target rounded-lg px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100 disabled:opacity-30 dark:text-ink-300 dark:hover:bg-dark-surface"
      >
        Redo
      </button>
      <button
        type="button"
        onClick={onClear}
        className="tap-target rounded-lg px-3 text-xs font-semibold text-again hover:bg-again/10"
      >
        Clear all
      </button>
    </div>
  );
}

function RevealModePicker({
  mode,
  onChange,
}: {
  mode: "overlay" | "side-by-side" | "toggle";
  onChange: (m: "overlay" | "side-by-side" | "toggle") => void;
}) {
  return (
    <div className="card-surface p-4">
      <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
        How the answer is revealed
      </p>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">
        What the student sees when they tap "Show answer" during study.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <RevealModeOption
          checked={mode === "toggle"}
          label="Switch back and forth"
          description="Tap to flip between the student's drawing and the model answer."
          onSelect={() => onChange("toggle")}
        />
        <RevealModeOption
          checked={mode === "overlay"}
          label="Overlay"
          description="The model answer fades in on top of the student's drawing."
          onSelect={() => onChange("overlay")}
        />
        <RevealModeOption
          checked={mode === "side-by-side"}
          label="Side by side"
          description="The two drawings sit next to each other for comparison."
          onSelect={() => onChange("side-by-side")}
        />
      </div>
    </div>
  );
}

function RevealModeOption({
  checked,
  label,
  description,
  onSelect,
}: {
  checked: boolean;
  label: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-100 p-2 hover:bg-ink-100/40 dark:border-dark-surface dark:hover:bg-dark-surface/40">
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        className="mt-1"
      />
      <span className="text-sm">
        <span className="block font-medium text-ink-900 dark:text-dark-ink">
          {label}
        </span>
        <span className="block text-xs text-ink-500 dark:text-ink-300">
          {description}
        </span>
      </span>
    </label>
  );
}

export default DrawingEditor;
