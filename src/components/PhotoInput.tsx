"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import PhotoEditor from "./PhotoEditor";
import { CropIcon } from "./icons";

/**
 * Decode a file with EXIF orientation already applied (consistent across browsers)
 * and downscale. Orientation of the garment itself is corrected later, after
 * background removal, based on the garment's bounding box.
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
  const MAX = 1280;
  const scale = Math.min(1, MAX / Math.max(srcW, srcH));
  const outW = Math.round(srcW * scale);
  const outH = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, outW, outH);

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

const TARGET_ASPECT = 3 / 4; // portrait card ratio used in the dressing grid

/**
 * Composite a transparent PNG onto white: keep only the main garment, crop to it,
 * straighten it to portrait, and centre it on a portrait 3:4 white canvas so it
 * sits upright in the dressing overview.
 */
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

  // Keep only the largest connected region; compute its bounding box on the way
  const { label, bestLabel } = keepLargestComponent(alpha, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    if (label[i] === bestLabel) {
      const x = i % w;
      const y = (i - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    } else {
      d[i * 4 + 3] = 0; // strip stray pieces
    }
  }
  mctx.putImageData(imageData, 0, 0);

  // No garment detected → fall back to a plain white composite
  if (maxX < 0) {
    const fb = document.createElement("canvas");
    fb.width = w;
    fb.height = h;
    const fctx = fb.getContext("2d")!;
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, w, h);
    fctx.drawImage(mask, 0, 0);
    return fb.toDataURL("image/png");
  }

  // Crop tightly to the garment
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const crop = document.createElement("canvas");
  crop.width = bw;
  crop.height = bh;
  crop.getContext("2d")!.drawImage(mask, minX, minY, bw, bh, 0, 0, bw, bh);

  // Straighten: if the garment lies sideways (wider than tall), rotate it upright
  let gCanvas: HTMLCanvasElement = crop;
  let gW = bw;
  let gH = bh;
  if (bw > bh) {
    const rot = document.createElement("canvas");
    rot.width = bh;
    rot.height = bw;
    const rctx = rot.getContext("2d")!;
    rctx.translate(bh, 0);
    rctx.rotate(Math.PI / 2);
    rctx.drawImage(crop, 0, 0);
    gCanvas = rot;
    gW = bh;
    gH = bw;
  }

  // Fit the garment into a portrait 3:4 canvas with a small margin, centred
  const pad = 0.9; // garment occupies up to 90% of the frame
  const gAspect = gW / gH;
  let cw: number, ch: number;
  if (gAspect <= TARGET_ASPECT) {
    ch = Math.round(gH / pad);
    cw = Math.round(ch * TARGET_ASPECT);
  } else {
    cw = Math.round(gW / pad);
    ch = Math.round(cw / TARGET_ASPECT);
  }

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, cw, ch);
  octx.filter = "contrast(1.05) saturate(1.08)";
  octx.drawImage(gCanvas, Math.round((cw - gW) / 2), Math.round((ch - gH) / 2));
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
  const [editing, setEditing] = useState(false);

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

        {/* Crop / rotate button — bottom-right of the photo */}
        {value && !processing && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t("form.edit_photo")}
            title={t("form.edit_photo")}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="absolute bottom-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-night/70 text-ivory shadow-lg backdrop-blur-sm transition hover:bg-night hover:scale-105 cursor-pointer"
          >
            <CropIcon className="h-4 w-4" />
          </span>
        )}
      </button>

      {editing && value && (
        <PhotoEditor
          src={value}
          onClose={() => setEditing(false)}
          onApply={(edited) => {
            onChange(edited);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
