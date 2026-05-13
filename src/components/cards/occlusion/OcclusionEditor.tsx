import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KonvaImage, Rect, Ellipse, Transformer } from "react-konva";
import type Konva from "konva";
import {
  storeMedia,
  useDecks,
  useCard,
  type OcclusionMask,
} from "../../../db";
import { newId } from "../../../db/ids";
import { compressImage } from "../../../media/image";
import { useObjectUrl } from "../../../media/useObjectUrl";
import {
  createOcclusionCardSet,
  updateOcclusionCardSet,
} from "../../../cards/occlusion";
import { Button } from "../../Button";
import { TagsInput } from "../../TagsInput";
import { FormField, inputClass } from "../../FormField";
import { ImageSourceDialog } from "../../media/ImageSourceDialog";
import { CameraCaptureDialog } from "../../media/CameraCaptureDialog";
import { isCameraSupported } from "../../../media/camera";

// Authoring screen for image-occlusion cards. Single page; on save it
// creates one card per mask (or per group). Editing an existing card finds
// every sibling that shares the same image + masks and rewrites the whole
// set so adjustments propagate.
//
// Masks are stored as normalised 0-1 coordinates so the same data renders
// correctly at any display size and survives a backup -> restore on a
// device with different DPI.

interface OcclusionEditorProps {
  initialDeckId?: string;
  cardId?: string;
}

// Local pixel-space mask shape, used while editing. We convert to/from the
// stored normalised shape at load + save time.
type Tool = "select" | "rect" | "ellipse";

interface PixelRect {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
}
interface PixelEllipse {
  kind: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}
type PixelGeom = PixelRect | PixelEllipse;

interface PixelMask {
  id: string;
  geom: PixelGeom;
  groupId?: string;
}

// Max display width for the canvas. Image is shown at natural size up to
// this cap so masks remain easy to position on big screens, but stays
// inside narrow viewports.
const MAX_DISPLAY_WIDTH = 900;

function OcclusionEditor({ initialDeckId, cardId }: OcclusionEditorProps) {
  const navigate = useNavigate();
  const decks = useDecks();
  const editingCard = useCard(cardId);
  const editing = Boolean(cardId);

  const [deckId, setDeckId] = useState<string | undefined>(initialDeckId);
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<"hide-one" | "hide-all">("hide-one");
  const [imageHash, setImageHash] = useState<string | undefined>();
  const [imageBytes, setImageBytes] = useState<number | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tool, setTool] = useState<Tool>("rect");
  const [drawingActive, setDrawingActive] = useState(true);
  const [masks, setMasks] = useState<PixelMask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftShape, setDraftShape] = useState<PixelGeom | null>(null);
  // Anchor point (pointer-down position) for the in-progress ellipse drag.
  // Without this the running cx/cy stored on draftShape gets re-averaged
  // on every pointermove, which collapses toward the latest pointer and
  // the ellipse never actually grows.
  const draftAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [past, setPast] = useState<PixelMask[][]>([]);
  const [future, setFuture] = useState<PixelMask[][]>([]);
  const [saving, setSaving] = useState(false);

  const [stageSize, setStageSize] = useState<{ width: number; height: number }>(
    { width: 0, height: 0 },
  );
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  const previewUrl = useObjectUrl(imageHash);
  const [konvaImage, setKonvaImage] = useState<HTMLImageElement | null>(null);

  // Load the existing card's content when editing.
  useEffect(() => {
    if (!editing || !editingCard || editingCard.content.type !== "occlusion") return;
    const c = editingCard.content;
    setDeckId(editingCard.deckId);
    setTags(editingCard.tags);
    setImageHash(c.imageHash);
    setMode(c.mode);
    // Wait for image to load before converting masks; we need pixel dims.
    // The conversion happens in the second effect.
  }, [editing, editingCard]);

  // Load image element for Konva + capture natural dimensions.
  useEffect(() => {
    if (!previewUrl) {
      setKonvaImage(null);
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
      setKonvaImage(img);
    };
    img.src = previewUrl;
  }, [previewUrl]);

  // Once we have stage dimensions AND we're editing, convert stored
  // normalised masks into pixel masks for the editor.
  useEffect(() => {
    if (!editing || !editingCard || editingCard.content.type !== "occlusion") return;
    if (stageSize.width === 0) return;
    const pixel = editingCard.content.masks.map((m) =>
      normToPixelMask(m, stageSize.width, stageSize.height),
    );
    setMasks(pixel);
    setPast([]);
    setFuture([]);
  }, [editing, editingCard, stageSize.width, stageSize.height]);

  // Attach Konva Transformer to the currently-selected node.
  useEffect(() => {
    const transformer = transformerRef.current;
    const node = selectedNodeRef.current;
    if (!transformer) return;
    if (selectedId && node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedId, masks]);

  const pushHistory = (prev: PixelMask[]) => {
    setPast((p) => [...p, prev]);
    setFuture([]);
  };

  const undo = () => {
    setPast((p) => {
      if (p.length === 0) return p;
      const previous = p[p.length - 1];
      setFuture((f) => [masks, ...f]);
      setMasks(previous);
      setSelectedId(null);
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p, masks]);
      setMasks(next);
      setSelectedId(null);
      return f.slice(1);
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory(masks);
    setMasks((m) => m.filter((x) => x.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const found = masks.find((m) => m.id === selectedId);
    if (!found) return;
    pushHistory(masks);
    const offset = 12; // pixels
    const copy: PixelMask = {
      id: newId(),
      groupId: found.groupId,
      geom: shiftGeom(found.geom, offset, offset),
    };
    setMasks((m) => [...m, copy]);
    setSelectedId(copy.id);
  };

  // --- Pointer handlers on the Stage ---

  const handlePointerDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If the user clicks the background and a drawing tool is active, start
    // a new shape. If they click a shape, the shape's own handlers take over.
    if (!drawingActive) return;
    if (tool === "select") {
      // Clicked the empty stage -> deselect.
      if (e.target === e.target.getStage()) setSelectedId(null);
      return;
    }
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    // Only start a draft if the click was on the stage background or the image.
    if (e.target !== stage && e.target.getClassName() !== "Image") return;
    if (tool === "rect") {
      setDraftShape({ kind: "rect", x: pointer.x, y: pointer.y, w: 0, h: 0 });
      draftAnchorRef.current = null;
    } else if (tool === "ellipse") {
      // Stash the anchor so subsequent moves recompute the ellipse from a
      // stable starting point.
      draftAnchorRef.current = { x: pointer.x, y: pointer.y };
      setDraftShape({
        kind: "ellipse",
        cx: pointer.x,
        cy: pointer.y,
        rx: 0,
        ry: 0,
      });
    }
  };

  const handlePointerMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawingActive || !draftShape) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (draftShape.kind === "rect") {
      setDraftShape({
        ...draftShape,
        w: pointer.x - draftShape.x,
        h: pointer.y - draftShape.y,
      });
    } else {
      // Use the stored anchor (pointer-down position) — not draftShape.cx/cy,
      // which drifts after the first move because we keep replacing it with
      // the midpoint.
      const anchor = draftAnchorRef.current ?? { x: draftShape.cx, y: draftShape.cy };
      const cx = (anchor.x + pointer.x) / 2;
      const cy = (anchor.y + pointer.y) / 2;
      const rx = Math.abs(pointer.x - anchor.x) / 2;
      const ry = Math.abs(pointer.y - anchor.y) / 2;
      setDraftShape({ kind: "ellipse", cx, cy, rx, ry });
    }
  };

  const handlePointerUp = () => {
    if (!draftShape) return;
    const normalised = normaliseDraftShape(draftShape);
    if (normalised && draftMaskArea(normalised) >= MIN_MASK_PIXELS) {
      pushHistory(masks);
      const id = newId();
      setMasks((m) => [...m, { id, geom: normalised }]);
      setSelectedId(id);
      // Switching to select after the draft commits feels natural: the user
      // can immediately fine-tune the position. They can pick the tool again
      // for the next mask.
      setTool("select");
    }
    setDraftShape(null);
    draftAnchorRef.current = null;
  };

  // --- Image picker ---

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
      setImageHash(compressed.hash);
      setImageBytes(compressed.bytes);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Image import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      throw new Error("Clipboard reads aren't supported here. Use the upload option or Ctrl+V into a text field.");
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
    deckId !== undefined && imageHash !== undefined && masks.length > 0;

  const save = async () => {
    if (!canSave || !deckId || !imageHash) return;
    setSaving(true);
    try {
      const normMasks: OcclusionMask[] = masks.map((m) =>
        pixelToNormMask(m, stageSize.width, stageSize.height),
      );
      if (editing && cardId) {
        await updateOcclusionCardSet(cardId, {
          deckId,
          tags,
          imageHash,
          masks: normMasks,
          mode,
        });
      } else {
        await createOcclusionCardSet({
          deckId,
          tags,
          imageHash,
          masks: normMasks,
          mode,
        });
      }
      navigate(`/decks/${deckId}`);
    } finally {
      setSaving(false);
    }
  };

  const stageContainerStyle: React.CSSProperties = {
    // Disabling browser touch behaviour inside the stage lets Konva handle
    // drawing without the page scrolling away. Outside the stage container,
    // normal touch behaviour resumes. The "Done drawing" toggle below flips
    // touchAction to "auto" so the user can scroll past on small screens.
    touchAction: drawingActive ? "none" : "auto",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  return (
    <div className="space-y-4">
      <header className="sticky top-14 -mx-4 -mt-4 z-10 border-b border-ink-100 bg-cream/95 px-4 py-3 backdrop-blur dark:border-dark-surface dark:bg-dark-bg/95 sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-navy dark:text-gold">
            {editing ? "Edit image-occlusion card" : "New image-occlusion card"}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button disabled={!canSave || saving} onClick={save}>
              {saving ? "Saving..." : `Save (${cardCountForMasks(masks)} card${cardCountForMasks(masks) === 1 ? "" : "s"})`}
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Deck" htmlFor="occ-deck">
          <select
            id="occ-deck"
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

      <ModeToggle mode={mode} onChange={setMode} />

      {!imageHash ? (
        <div className="card-surface p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Step 1
          </h2>
          <p className="mt-1 text-base font-medium text-ink-900 dark:text-dark-ink">
            Add the image you want to hide parts of
          </p>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-300">
            Pick a file from this device or paste a screenshot.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => setPickerOpen(true)} disabled={importing}>
              {importing ? "Importing..." : "Add image"}
            </Button>
            {importError && (
              <p role="alert" className="text-sm text-again">
                {importError}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="card-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-300">
            Step 2
          </h2>
          <p className="mt-1 text-base font-medium text-ink-900 dark:text-dark-ink">
            Drag on the image to cover what you want hidden
          </p>
          <p className="mt-0.5 text-sm text-ink-500 dark:text-ink-300">
            Each shape becomes its own card. {imageBytes !== undefined && `Image is ${(imageBytes / 1024).toFixed(0)} KB.`}
          </p>

          <Toolbar
            tool={tool}
            onToolChange={setTool}
            onUndo={undo}
            onRedo={redo}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            drawingActive={drawingActive}
            onToggleDrawing={() => setDrawingActive((v) => !v)}
            onReplaceImage={() => setPickerOpen(true)}
          />

          {selectedId && (
            <SelectionMenu
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
            />
          )}

          <div
            className="mt-3 max-h-[70vh] overflow-auto"
            style={stageContainerStyle}
          >
            <div
              className="mx-auto bg-ink-100/40"
              style={{ width: stageSize.width, height: stageSize.height }}
            >
              {konvaImage && stageSize.width > 0 ? (
                <Stage
                  ref={stageRef}
                  width={stageSize.width}
                  height={stageSize.height}
                  onMouseDown={handlePointerDown}
                  onMouseMove={handlePointerMove}
                  onMouseUp={handlePointerUp}
                  onTouchStart={handlePointerDown}
                  onTouchMove={handlePointerMove}
                  onTouchEnd={handlePointerUp}
                  listening={drawingActive}
                >
                  <Layer>
                    <KonvaImage image={konvaImage} width={stageSize.width} height={stageSize.height} listening={false} />
                  </Layer>
                  <Layer>
                    {masks.map((m) => (
                      <MaskNode
                        key={m.id}
                        mask={m}
                        selected={m.id === selectedId}
                        draggable={drawingActive}
                        onSelect={(node) => {
                          selectedNodeRef.current = node;
                          setSelectedId(m.id);
                          setTool("select");
                        }}
                        onChange={(geom) => {
                          pushHistory(masks);
                          setMasks((prev) =>
                            prev.map((x) =>
                              x.id === m.id ? { ...x, geom } : x,
                            ),
                          );
                        }}
                      />
                    ))}
                    {draftShape && <DraftShape geom={draftShape} />}
                    <Transformer
                      ref={transformerRef}
                      anchorSize={14}
                      borderStroke="#1E3A5F"
                      anchorStroke="#1E3A5F"
                      anchorFill="#FAF7F2"
                      rotateEnabled={false}
                      keepRatio={false}
                    />
                  </Layer>
                </Stage>
              ) : (
                <p className="p-6 text-center text-sm text-ink-500">
                  Loading image...
                </p>
              )}
            </div>
          </div>

        </div>
      )}

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

function Toolbar({
  tool,
  onToolChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  drawingActive,
  onToggleDrawing,
  onReplaceImage,
}: {
  tool: Tool;
  onToolChange: (t: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  drawingActive: boolean;
  onToggleDrawing: () => void;
  onReplaceImage: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1 rounded-xl border border-ink-100 bg-cream/40 p-1.5 dark:border-dark-surface dark:bg-dark-bg/40">
      <ToolButton active={tool === "select"} onClick={() => onToolChange("select")}>
        Select
      </ToolButton>
      <ToolButton active={tool === "rect"} onClick={() => onToolChange("rect")}>
        Rectangle
      </ToolButton>
      <ToolButton active={tool === "ellipse"} onClick={() => onToolChange("ellipse")}>
        Ellipse
      </ToolButton>
      <span className="mx-1 h-6 w-px bg-ink-200 dark:bg-dark-surface" />
      <ToolButton disabled={!canUndo} onClick={onUndo}>
        Undo
      </ToolButton>
      <ToolButton disabled={!canRedo} onClick={onRedo}>
        Redo
      </ToolButton>
      <span className="ml-auto inline-flex gap-1">
        <ToolButton onClick={onToggleDrawing}>
          {drawingActive ? "Done drawing" : "Resume drawing"}
        </ToolButton>
        <ToolButton onClick={onReplaceImage}>Replace image</ToolButton>
      </span>
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tap-target inline-flex items-center justify-center rounded-lg px-3 text-xs font-semibold transition-colors disabled:opacity-30 ${
        active
          ? "bg-navy text-cream"
          : "text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-dark-surface"
      }`}
    >
      {children}
    </button>
  );
}

function SelectionMenu({
  onDelete,
  onDuplicate,
}: {
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-ink-200 bg-surface px-2 py-1 text-xs shadow-sm dark:border-dark-surface dark:bg-dark-bg">
      <button
        type="button"
        onClick={onDuplicate}
        className="rounded-full px-2 py-1 text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-dark-surface"
      >
        Duplicate
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-full px-2 py-1 text-again hover:bg-again/10"
      >
        Delete
      </button>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "hide-one" | "hide-all";
  onChange: (m: "hide-one" | "hide-all") => void;
}) {
  return (
    <div className="card-surface p-4">
      <p className="text-sm font-medium text-ink-900 dark:text-dark-ink">
        What's hidden on each card
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="occ-mode"
            checked={mode === "hide-one"}
            onChange={() => onChange("hide-one")}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="block font-medium text-ink-900 dark:text-dark-ink">
              Hide one at a time
            </span>
            <span className="block text-xs text-ink-500 dark:text-ink-300">
              Each card hides just one shape; the others are visible as clues.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="radio"
            name="occ-mode"
            checked={mode === "hide-all"}
            onChange={() => onChange("hide-all")}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="block font-medium text-ink-900 dark:text-dark-ink">
              Hide everything
            </span>
            <span className="block text-xs text-ink-500 dark:text-ink-300">
              Every shape is hidden; the card reveals one when tapped.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}

function MaskNode({
  mask,
  selected,
  draggable,
  onSelect,
  onChange,
}: {
  mask: PixelMask;
  selected: boolean;
  draggable: boolean;
  onSelect: (node: Konva.Node) => void;
  onChange: (next: PixelGeom) => void;
}) {
  // Konva needs absolute pixel coordinates and a stable shape so the
  // Transformer can adjust width/height in place.
  if (mask.geom.kind === "rect") {
    const g = mask.geom;
    return (
      <Rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        cornerRadius={6}
        fill={selected ? "rgba(30,58,95,0.4)" : "rgba(30,58,95,0.6)"}
        stroke={selected ? "#C9A14A" : "#0F1E33"}
        strokeWidth={selected ? 2 : 1}
        draggable={draggable}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          onSelect(e.target);
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
          onSelect(e.target);
        }}
        onDragEnd={(e) => {
          onChange({ kind: "rect", x: e.target.x(), y: e.target.y(), w: g.w, h: g.h });
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            kind: "rect",
            x: node.x(),
            y: node.y(),
            w: Math.max(8, g.w * scaleX),
            h: Math.max(8, g.h * scaleY),
          });
        }}
      />
    );
  }
  const g = mask.geom;
  return (
    <Ellipse
      x={g.cx}
      y={g.cy}
      radiusX={g.rx}
      radiusY={g.ry}
      fill={selected ? "rgba(30,58,95,0.4)" : "rgba(30,58,95,0.6)"}
      stroke={selected ? "#C9A14A" : "#0F1E33"}
      strokeWidth={selected ? 2 : 1}
      draggable={draggable}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect(e.target);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        onSelect(e.target);
      }}
      onDragEnd={(e) => {
        onChange({ kind: "ellipse", cx: e.target.x(), cy: e.target.y(), rx: g.rx, ry: g.ry });
      }}
      onTransformEnd={(e) => {
        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        onChange({
          kind: "ellipse",
          cx: node.x(),
          cy: node.y(),
          rx: Math.max(4, g.rx * scaleX),
          ry: Math.max(4, g.ry * scaleY),
        });
      }}
    />
  );
}

function DraftShape({ geom }: { geom: PixelGeom }) {
  if (geom.kind === "rect") {
    return (
      <Rect
        x={Math.min(geom.x, geom.x + geom.w)}
        y={Math.min(geom.y, geom.y + geom.h)}
        width={Math.abs(geom.w)}
        height={Math.abs(geom.h)}
        cornerRadius={6}
        fill="rgba(30,58,95,0.4)"
        stroke="#C9A14A"
        strokeWidth={1.5}
        dash={[6, 4]}
        listening={false}
      />
    );
  }
  return (
    <Ellipse
      x={geom.cx}
      y={geom.cy}
      radiusX={geom.rx}
      radiusY={geom.ry}
      fill="rgba(30,58,95,0.4)"
      stroke="#C9A14A"
      strokeWidth={1.5}
      dash={[6, 4]}
      listening={false}
    />
  );
}

// --- Coordinate conversion + helpers ---

const MIN_MASK_PIXELS = 100; // minimum area in px^2 to commit a draft shape

function normaliseDraftShape(draft: PixelGeom): PixelGeom | null {
  if (draft.kind === "rect") {
    const x = Math.min(draft.x, draft.x + draft.w);
    const y = Math.min(draft.y, draft.y + draft.h);
    const w = Math.abs(draft.w);
    const h = Math.abs(draft.h);
    if (w < 4 || h < 4) return null;
    return { kind: "rect", x, y, w, h };
  }
  if (draft.rx < 2 || draft.ry < 2) return null;
  return draft;
}

function draftMaskArea(geom: PixelGeom): number {
  if (geom.kind === "rect") return geom.w * geom.h;
  return Math.PI * geom.rx * geom.ry;
}

function shiftGeom(geom: PixelGeom, dx: number, dy: number): PixelGeom {
  if (geom.kind === "rect") {
    return { ...geom, x: geom.x + dx, y: geom.y + dy };
  }
  return { ...geom, cx: geom.cx + dx, cy: geom.cy + dy };
}

function pixelToNormMask(
  m: PixelMask,
  stageW: number,
  stageH: number,
): OcclusionMask {
  if (m.geom.kind === "rect") {
    return {
      id: m.id,
      groupId: m.groupId,
      shape: "rect",
      geometry: {
        x: m.geom.x / stageW,
        y: m.geom.y / stageH,
        w: m.geom.w / stageW,
        h: m.geom.h / stageH,
      },
    };
  }
  return {
    id: m.id,
    groupId: m.groupId,
    shape: "ellipse",
    geometry: {
      cx: m.geom.cx / stageW,
      cy: m.geom.cy / stageH,
      rx: m.geom.rx / stageW,
      ry: m.geom.ry / stageH,
    },
  };
}

function normToPixelMask(
  m: OcclusionMask,
  stageW: number,
  stageH: number,
): PixelMask {
  if (m.shape === "rect") {
    const g = m.geometry as { x: number; y: number; w: number; h: number };
    return {
      id: m.id,
      groupId: m.groupId,
      geom: {
        kind: "rect",
        x: g.x * stageW,
        y: g.y * stageH,
        w: g.w * stageW,
        h: g.h * stageH,
      },
    };
  }
  if (m.shape === "ellipse") {
    const g = m.geometry as { cx: number; cy: number; rx: number; ry: number };
    return {
      id: m.id,
      groupId: m.groupId,
      geom: {
        kind: "ellipse",
        cx: g.cx * stageW,
        cy: g.cy * stageH,
        rx: g.rx * stageW,
        ry: g.ry * stageH,
      },
    };
  }
  // Polygons not authored yet; treat as a tiny placeholder rect so the
  // editor doesn't crash if a backup with polygons is loaded.
  return {
    id: m.id,
    groupId: m.groupId,
    geom: { kind: "rect", x: 0, y: 0, w: 0, h: 0 },
  };
}

function cardCountForMasks(masks: PixelMask[]): number {
  const groups = new Set<string>();
  for (const m of masks) groups.add(m.groupId ?? m.id);
  return groups.size;
}

// Default export so the route can React.lazy() it.
export default OcclusionEditor;
