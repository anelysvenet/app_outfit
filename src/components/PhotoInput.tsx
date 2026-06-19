"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import PhotoEditor from "./PhotoEditor";
import LogoLoader from "./LogoLoader";
import ErrorBoundary from "./ErrorBoundary";
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

type LogoBox = { x: number; y: number; w: number; h: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/** Paste the real logo pixels from the original photo back over the ironed
 *  garment (feathered, within the silhouette) so prints stay authentic. */
async function pasteLogos(
  mctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  originalSrc: string,
  boxes: LogoBox[],
) {
  if (!boxes.length) return;
  const orig = await loadImage(originalSrc);
  const OW = orig.naturalWidth;
  const OH = orig.naturalHeight;
  for (const b of boxes) {
    const dw = Math.max(1, Math.round(b.w * w));
    const dh = Math.max(1, Math.round(b.h * h));
    const dx = Math.round(b.x * w);
    const dy = Math.round(b.y * h);
    const fc = document.createElement("canvas");
    fc.width = dw;
    fc.height = dh;
    const fctx = fc.getContext("2d", { willReadFrequently: true })!;
    fctx.drawImage(orig, b.x * OW, b.y * OH, b.w * OW, b.h * OH, 0, 0, dw, dh);
    const fid = fctx.getImageData(0, 0, dw, dh);
    const p = fid.data;
    const fm = Math.max(2, Math.min(dw, dh) * 0.16);
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const edge = Math.min(x, y, dw - 1 - x, dh - 1 - y);
        const f = Math.max(0, Math.min(1, edge / fm));
        p[(y * dw + x) * 4 + 3] *= f;
      }
    }
    fctx.putImageData(fid, 0, 0);
    mctx.save();
    mctx.globalCompositeOperation = "source-atop";
    mctx.drawImage(fc, dx, dy, dw, dh);
    mctx.restore();
  }
}

/**
 * Edge-preserving smoothing ("ironing") — non-generative. Averages a pixel with
 * a blurred copy only in low-contrast areas (soft wrinkle shadows), while strong
 * edges (logos, prints, seams) are left untouched. It never invents pixels, so
 * colours, prints and shape stay faithful.
 */
function smoothFabric(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;

  const blurred = document.createElement("canvas");
  blurred.width = w;
  blurred.height = h;
  const bctx = blurred.getContext("2d")!;
  bctx.filter = `blur(${Math.max(2, Math.round(Math.min(w, h) * 0.012))}px)`;
  bctx.drawImage(src, 0, 0);
  bctx.filter = "none";

  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const o = sctx.getImageData(0, 0, w, h);
  const od = o.data;
  const bd = blurred.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h).data;

  const amount = 0.75; // max smoothing in flat areas
  const thr = 46; // edge sensitivity — above this, detail is preserved
  for (let i = 0; i < od.length; i += 4) {
    const de =
      Math.abs(od[i] - bd[i]) +
      Math.abs(od[i + 1] - bd[i + 1]) +
      Math.abs(od[i + 2] - bd[i + 2]);
    const a = Math.max(0, 1 - de / thr) * amount;
    od[i] = od[i] * (1 - a) + bd[i] * a;
    od[i + 1] = od[i + 1] * (1 - a) + bd[i + 1] * a;
    od[i + 2] = od[i + 2] * (1 - a) + bd[i + 2] * a;
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.putImageData(o, 0, 0);
  return out;
}

/**
 * Make background-connected near-white pixels transparent. Starts from the image
 * border and flows through already-transparent + near-white pixels, so leftover
 * background the matte missed — typically the gap BETWEEN trouser legs (reachable
 * via the opening at the hems) — gets cut out. Interior white that is enclosed by
 * the garment (e.g. a white top) is preserved.
 */
function openBackground(d: Uint8ClampedArray, w: number, h: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  // Only near-PURE white (studio backdrop) is treated as background, so real
  // (slightly shaded) white garments are not eaten into.
  const removable = (p: number) => {
    const o = p * 4;
    return d[o + 3] < 30 || (d[o] > 248 && d[o + 1] > 248 && d[o + 2] > 248);
  };
  for (let x = 0; x < w; x++) {
    stack.push(x, (h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    if (!removable(p)) continue;
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
}

const TARGET_ASPECT = 3 / 4; // portrait card ratio used in the dressing grid

/**
 * From the background-removed PNG, keep only the main garment, crop to it and
 * straighten it to portrait. Returns BOTH a transparent cut-out (true alpha —
 * so the gap between trouser legs is see-through) and the same on a white 3:4
 * canvas (used in grids and virtual try-on).
 */
async function buildImages(
  transparentDataUrl: string,
  opts?: { ironedDataUrl?: string | null; originalSrc?: string; logoBoxes?: LogoBox[] },
): Promise<{ white: string; cutout: string }> {
  const img = await loadImage(transparentDataUrl);

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d", { willReadFrequently: true })!;
  mctx.drawImage(img, 0, 0); // alpha + original RGB from BiRefNet on the ORIGINAL

  // Overlay the ironed RGB only inside the silhouette (keeps the real alpha,
  // e.g. the gap between trouser legs)
  if (opts?.ironedDataUrl) {
    try {
      const ironed = await loadImage(opts.ironedDataUrl);
      mctx.save();
      mctx.globalCompositeOperation = "source-atop";
      mctx.drawImage(ironed, 0, 0, w, h);
      mctx.restore();
    } catch (e) {
      console.warn("[ironed overlay] failed:", e);
    }
  }

  // Restore the real logos over the ironed fabric
  if (opts?.originalSrc && opts.logoBoxes && opts.logoBoxes.length) {
    try {
      await pasteLogos(mctx, w, h, opts.originalSrc, opts.logoBoxes);
    } catch (e) {
      console.warn("[pasteLogos] failed:", e);
    }
  }

  const imageData = mctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const n = w * h;

  // Cut leftover background connected to the border (e.g. between trouser legs)
  openBackground(d, w, h);

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

  // No garment detected → fall back to the raw matte on white
  if (maxX < 0) {
    const fb = document.createElement("canvas");
    fb.width = w;
    fb.height = h;
    const fctx = fb.getContext("2d")!;
    fctx.fillStyle = "#ffffff";
    fctx.fillRect(0, 0, w, h);
    fctx.drawImage(mask, 0, 0);
    return { white: fb.toDataURL("image/png"), cutout: mask.toDataURL("image/png") };
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

  // Fit the garment into a portrait 3:4 frame with a small margin, centred
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
  const dx = Math.round((cw - gW) / 2);
  const dy = Math.round((ch - gH) / 2);

  // Transparent cut-out (keeps the real alpha, e.g. between trouser legs)
  const cut = document.createElement("canvas");
  cut.width = cw;
  cut.height = ch;
  const cctx = cut.getContext("2d")!;
  cctx.filter = "contrast(1.05) saturate(1.08)";
  cctx.drawImage(gCanvas, dx, dy);
  cctx.filter = "none";

  // White-background version, then edge-preserving smoothing ("ironing")
  const whiteFlat = document.createElement("canvas");
  whiteFlat.width = cw;
  whiteFlat.height = ch;
  const wfctx = whiteFlat.getContext("2d")!;
  wfctx.fillStyle = "#ffffff";
  wfctx.fillRect(0, 0, cw, ch);
  wfctx.drawImage(cut, 0, 0);
  const smoothed = smoothFabric(whiteFlat); // opaque, wrinkles softened

  // Re-apply the real alpha to get the smoothed transparent cut-out
  const smoothedCut = document.createElement("canvas");
  smoothedCut.width = cw;
  smoothedCut.height = ch;
  const scctx = smoothedCut.getContext("2d", { willReadFrequently: true })!;
  scctx.drawImage(smoothed, 0, 0);
  const sd = scctx.getImageData(0, 0, cw, ch);
  const alphaSrc = cut.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, cw, ch).data;
  for (let i = 3; i < sd.data.length; i += 4) sd.data[i] = alphaSrc[i];
  scctx.putImageData(sd, 0, 0);

  return { white: smoothed.toDataURL("image/png"), cutout: smoothedCut.toDataURL("image/png") };
}

/** Background removal. Returns { white, cutout }; falls back to the original. */
async function processPhoto(dataUrl: string): Promise<{ white: string; cutout?: string }> {
  try {
    const padded = await padImage(dataUrl);
    const res = await fetch("/api/garments/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDataUrl: padded }),
    });
    if (!res.ok) return { white: dataUrl };
    const data = await res.json();
    if (data.skipped || !data.transparentDataUrl) return { white: dataUrl };
    return await buildImages(data.transparentDataUrl, {
      ironedDataUrl: data.ironedDataUrl,
      originalSrc: padded,
      logoBoxes: data.logoBoxes ?? [],
    });
  } catch {
    return { white: dataUrl };
  }
}

export default function PhotoInput({
  value,
  onChange,
  onCutout,
  label,
  aspect = "aspect-[3/4]",
}: {
  value: string | null;
  onChange: (dataUrl: string) => void;
  onCutout?: (dataUrl: string) => void;
  label: string;
  aspect?: string;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    <div className="relative">
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

            // Background removal (non-blocking, falls back on error)
            setProcessing(true);
            const processed = await processPhoto(dataUrl);
            onChange(processed.white);
            if (processed.cutout) onCutout?.(processed.cutout);
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

      {/* Processing overlay (logo animation) — sibling of the button so the
          loader's div isn't nested inside a <button> */}
      {processing && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-ivory/85 backdrop-blur-sm">
          <LogoLoader size={48} label={t("form.processing")} />
        </div>
      )}

      {editing && value && (
        <ErrorBoundary onError={() => setEditing(false)}>
        <PhotoEditor
          src={value}
          onClose={() => setEditing(false)}
          onApply={async (edited) => {
            setEditing(false);
            try {
              const im = await loadImage(edited);
              const c = document.createElement("canvas");
              c.width = im.naturalWidth;
              c.height = im.naturalHeight;
              const cx = c.getContext("2d", { willReadFrequently: true })!;
              cx.drawImage(im, 0, 0);
              // Did the user erase anything? (any transparent pixel)
              const d = cx.getImageData(0, 0, c.width, c.height).data;
              let hasAlpha = false;
              for (let i = 3; i < d.length; i += 4) {
                if (d[i] < 250) { hasAlpha = true; break; }
              }
              if (hasAlpha) {
                // Keep the erased cut-out transparent for the render, and a
                // white-bg version for grids/try-on
                onCutout?.(edited);
                const wc = document.createElement("canvas");
                wc.width = c.width;
                wc.height = c.height;
                const wx = wc.getContext("2d")!;
                wx.fillStyle = "#ffffff";
                wx.fillRect(0, 0, wc.width, wc.height);
                wx.drawImage(im, 0, 0);
                onChange(wc.toDataURL("image/png"));
              } else {
                onChange(edited);
              }
            } catch {
              onChange(edited);
            }
          }}
        />
        </ErrorBoundary>
      )}
    </div>
  );
}
