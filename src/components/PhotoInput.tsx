"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";

/**
 * Decode a file with EXIF orientation already applied (consistent across browsers),
 * auto-rotate true landscape photos to portrait, and downscale.
 */
async function fileToDataUrl(file: File): Promise<string> {
  // imageOrientation "from-image" bakes in EXIF rotation, so width/height are visually correct
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const isLandscape = srcW > srcH; // only rotate genuine landscape photos

  // Target portrait display dimensions
  const dispW = isLandscape ? srcH : srcW;
  const dispH = isLandscape ? srcW : srcH;

  const MAX = 1280;
  const scale = Math.min(1, MAX / Math.max(dispW, dispH));
  const outW = Math.round(dispW * scale);
  const outH = Math.round(dispH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  if (isLandscape) {
    // Rotate 90° clockwise into the portrait canvas
    ctx.translate(outW, 0);
    ctx.rotate(Math.PI / 2);
    // In rotated space the axes are swapped: draw to (outH × outW)
    ctx.drawImage(bitmap, 0, 0, outH, outW);
  } else {
    ctx.drawImage(bitmap, 0, 0, outW, outH);
  }

  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Add a dark contrasting border so garment edges never touch the frame (prevents API clipping). */
async function padImage(dataUrl: string, pct = 0.12): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = dataUrl;
  });
  const px = Math.round(img.naturalWidth * pct);
  const py = Math.round(img.naturalHeight * pct);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth + px * 2;
  canvas.height = img.naturalHeight + py * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2d3a4a"; // dark blue-grey — contrasts with all clothing colours
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, px, py);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Keep only the largest connected opaque region; zero out everything else.
 * Removes stray garment pieces sitting next to the main item.
 */
function keepLargestComponent(alpha: Uint8Array, w: number, h: number) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let cur = 0;
  let bestLabel = -1;
  let bestSize = 0;

  for (let i = 0; i < n; i++) {
    if (alpha[i] === 0 || label[i] !== -1) continue;
    let sp = 0;
    stack[sp++] = i;
    label[i] = cur;
    let size = 0;
    while (sp > 0) {
      const p = stack[--sp];
      size++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) { const q = p - 1; if (alpha[q] && label[q] === -1) { label[q] = cur; stack[sp++] = q; } }
      if (x < w - 1) { const q = p + 1; if (alpha[q] && label[q] === -1) { label[q] = cur; stack[sp++] = q; } }
      if (y > 0) { const q = p - w; if (alpha[q] && label[q] === -1) { label[q] = cur; stack[sp++] = q; } }
      if (y < h - 1) { const q = p + w; if (alpha[q] && label[q] === -1) { label[q] = cur; stack[sp++] = q; } }
    }
    if (size > bestSize) { bestSize = size; bestLabel = cur; }
    cur++;
  }
  return { label, bestLabel };
}

/** Composite a transparent PNG onto white with crisp edges, keeping only the main garment. */
async function compositeOnWhite(transparentDataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = transparentDataUrl;
  });

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d")!;
  mctx.drawImage(img, 0, 0);

  const imageData = mctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const n = w * h;

  // Threshold alpha to binary → crisp edges, no semi-transparent fringe
  const alpha = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] > 30 ? 1 : 0;
    alpha[i] = a;
    d[i * 4 + 3] = a ? 255 : 0;
  }

  // Strip stray pieces: keep only the largest connected region
  const { label, bestLabel } = keepLargestComponent(alpha, w, h);
  if (bestLabel >= 0) {
    for (let i = 0; i < n; i++) {
      if (label[i] !== bestLabel) d[i * 4 + 3] = 0;
    }
  }
  mctx.putImageData(imageData, 0, 0);

  // Composite cleaned garment onto white background
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, w, h);
  octx.filter = "contrast(1.05) saturate(1.08)";
  octx.drawImage(mask, 0, 0);
  octx.filter = "none";

  return out.toDataURL("image/png"); // PNG → artefact-free white background
}

/** Send photo to server for dewrinkling + background removal. Falls back to original on error. */
async function processPhoto(dataUrl: string): Promise<string> {
  try {
    const padded = await padImage(dataUrl);
    const res = await fetch("/api/garments/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDataUrl: padded }),
    });
    if (!res.ok) return dataUrl;
    const data = await res.json();
    if (data.skipped || !data.transparentDataUrl) return dataUrl;
    return await compositeOnWhite(data.transparentDataUrl);
  } catch {
    return dataUrl;
  }
}

export default function PhotoInput({
  value,
  onChange,
  label,
  aspect = "aspect-[3/4]",
}: {
  value: string | null;
  onChange: (dataUrl: string) => void;
  label: string;
  aspect?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          try {
            const dataUrl = await fileToDataUrl(file); // EXIF-correct, auto-rotated, resized
            onChange(dataUrl); // show preview immediately
            setLoading(false);

            // Dewrinkle + background removal (non-blocking, falls back on error)
            setProcessing(true);
            const processed = await processPhoto(dataUrl);
            onChange(processed);
          } finally {
            setLoading(false);
            setProcessing(false);
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative w-full ${aspect} overflow-hidden rounded-2xl border-2 border-dashed transition cursor-pointer ${
          value ? "border-transparent" : "border-linen hover:border-gold"
        } bg-sand/60`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-smoke">
            <span className="text-3xl font-light">+</span>
            <span className="text-sm">{loading ? "…" : label}</span>
          </span>
        )}

        {/* Hover overlay — hidden while processing */}
        {value && !processing && (
          <span className="absolute inset-0 flex items-center justify-center bg-night/0 text-ivory opacity-0 transition group-hover:bg-night/40 group-hover:opacity-100 text-sm">
            {t("form.change_photo")}
          </span>
        )}

        {/* Processing overlay */}
        {processing && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night/55 backdrop-blur-sm">
            <span className="text-[10px] uppercase tracking-[0.3em] text-champagne/80 animate-pulse">
              {t("form.processing")}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
