// Auto "document mode" touch-up for photos of paper / handwriting / whiteboards.
// Two passes:
//   1. Find the luminance min and max across the image.
//   2. Stretch every pixel's channels into the full 0-255 range and apply a
//      soft S-curve to crisp up the contrast between paper and ink without
//      crushing midtones.
//
// Not a fancy scan: no perspective correction, no adaptive thresholding.
// What it does buy:
//   - Off-white paper actually looks white instead of dim.
//   - Pencil lines and pen strokes stand out cleanly.
//   - A photo taken under warm room lighting reads close to neutral.
//
// All work happens in-place on the canvas. Caller decides whether to
// rebuild a Blob from the canvas (toBlob) or pass it on for further work.

const MIN_RANGE = 20;
const S_CURVE_EXPONENT = 1.4;

export function applyDocumentMode(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): void {
  const ctx = (canvas as HTMLCanvasElement).getContext
    ? (canvas as HTMLCanvasElement).getContext("2d")
    : (canvas as OffscreenCanvas).getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  if (w === 0 || h === 0) return;

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Pass 1: luminance bounds. Sample every pixel - canvases up to 1000px on
  // the long edge are well under a million pixels, fine for a one-shot pass.
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const range = Math.max(MIN_RANGE, max - min);

  // Pass 2: stretch + S-curve per channel.
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const stretched = ((d[i + c] - min) * 255) / range;
      const clamped = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched;
      const x = clamped / 255;
      const out =
        x < 0.5
          ? 0.5 * Math.pow(2 * x, S_CURVE_EXPONENT)
          : 1 - 0.5 * Math.pow(2 * (1 - x), S_CURVE_EXPONENT);
      d[i + c] = Math.round(out * 255);
    }
    // Leave alpha untouched.
  }
  ctx.putImageData(imageData, 0, 0);
}

// Resize a source canvas to fit within maxEdge on the long side, optionally
// applying document-mode in the process, and return a WebP Blob ready for
// storeMedia.
export async function canvasToProcessedBlob(
  source: HTMLCanvasElement,
  options: { maxEdge?: number; documentMode?: boolean; quality?: number } = {},
): Promise<Blob> {
  const maxEdge = options.maxEdge ?? 1000;
  const quality = options.quality ?? 0.82;

  const longEdge = Math.max(source.width, source.height);
  const scale = longEdge > maxEdge ? maxEdge / longEdge : 1;
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);

  const target = document.createElement("canvas");
  target.width = w;
  target.height = h;
  const ctx = target.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, w, h);
  if (options.documentMode) applyDocumentMode(target);

  return new Promise<Blob>((resolve, reject) => {
    target.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("toBlob returned null")),
      "image/webp",
      quality,
    );
  });
}
