// Image import pipeline: decode -> resize -> encode WebP -> hash.
// All work on the main thread for simplicity; image sizes are small (<=
// 1000px long edge) so block time stays under a frame even on iPad.

import { sha256Hex } from "./hash";

const MAX_EDGE = 1000;
const WEBP_QUALITY = 0.82;

export interface CompressedImage {
  blob: Blob;
  hash: string;
  bytes: number;
  width: number;
  height: number;
  mimeType: "image/webp";
}

export async function compressImage(file: File | Blob): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, MAX_EDGE);
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToWebp(canvas, WEBP_QUALITY);
    const hash = await sha256Hex(blob);
    return {
      blob,
      hash,
      bytes: blob.size,
      width,
      height,
      mimeType: "image/webp",
    };
  } finally {
    bitmap.close();
  }
}

// Browsers without OffscreenCanvas (Safari historically) fall back to the
// regular HTMLCanvasElement path.
function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function canvasToWebp(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/webp", quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/webp",
      quality,
    );
  });
}

function scaleToFit(w: number, h: number, maxEdge: number) {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longEdge;
  return {
    width: Math.round(w * scale),
    height: Math.round(h * scale),
  };
}

// Resolve a stored MediaBlob to an object URL the browser can render. Caller
// owns the URL lifetime and must revoke it when no longer needed.
export function objectUrlFromBlob(blob: Blob): string {
  return URL.createObjectURL(blob);
}
