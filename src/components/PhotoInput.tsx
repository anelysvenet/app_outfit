"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import PhotoEditor from "./PhotoEditor";
import LogoLoader from "./LogoLoader";
import ErrorBoundary from "./ErrorBoundary";
import { CropIcon } from "./icons";

/**
 * Decode a file with EXIF orientation already applied (consistent across
 * browsers) and downscale. This is step 1 of the pipeline: the image is upright
 * before anything else touches it.
 */
async function fileToDataUrl(file: File): Promise<string> {
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/**
 * Steps 5–9, working from a TRANSPARENT image only (never the full photo):
 *  5. measure the garment's bounding box,
 *  6. rotate ONLY the garment 90° if it is vertical, so it lies horizontal,
 *  7. keep the exact proportions (no stretching),
 *  8. place it in a landscape transparent canvas with a margin all around,
 *  9. centered.
 * Returns a transparent PNG data URL.
 */
function layoutGarment(img: HTMLImageElement): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;

  // (5) bounding box of the opaque garment
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  const crop = document.createElement("canvas");
  crop.width = bw;
  crop.height = bh;
  crop.getContext("2d")!.drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh);

  // (6) rotate the garment 90° if vertical → horizontal (proportions preserved)
  let g: HTMLCanvasElement = crop;
  let gw = bw;
  let gh = bh;
  if (bh > bw) {
    const r = document.createElement("canvas");
    r.width = bh;
    r.height = bw;
    const rx = r.getContext("2d")!;
    rx.translate(bh, 0);
    rx.rotate(Math.PI / 2);
    rx.drawImage(crop, 0, 0);
    g = r;
    gw = bh;
    gh = bw;
  }

  // (8–9) landscape transparent canvas, uniform margin all around, centered
  const margin = Math.round(Math.max(gw, gh) * 0.08);
  const cw = gw + margin * 2;
  const ch = gh + margin * 2;
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(g, margin, margin);
  return out.toDataURL("image/png");
}

/**
 * Steps 2–4 + 5–9: detour the garment with a real, in-browser background-removal
 * model (works even when fal.ai is down — FLUX is NEVER used for detouring), then
 * lay it out. Returns a transparent PNG, or null on failure.
 */
async function detour(dataUrl: string): Promise<string | null> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(dataUrl, { output: { format: "image/png" } });
    const url = URL.createObjectURL(blob);
    try {
      const img = await loadImage(url);
      return layoutGarment(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (e) {
    console.warn("[detour] failed:", e);
    return null;
  }
}

/**
 * Step 10 (LAST, optional): if FLUX is available, apply a very light de-wrinkle
 * to the already-detoured garment. Returns the de-wrinkled transparent PNG, or
 * null if the service is unavailable (in which case we keep the detoured PNG).
 */
async function dewrinkle(transparentDataUrl: string): Promise<string | null> {
  try {
    const res = await fetch("/api/garments/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoDataUrl: transparentDataUrl }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return !data.skipped && data.transparentDataUrl ? data.transparentDataUrl : null;
  } catch {
    return null;
  }
}

/** Apply the optional last step to a transparent garment PNG. */
async function finishTransparent(transparent: string): Promise<{ white: string; cutout: string }> {
  const ironed = await dewrinkle(transparent);
  const final = ironed ?? transparent;
  return { white: final, cutout: final };
}

/**
 * Full pipeline for a raw photo: detour → orient/rotate/resize/center → (light
 * de-wrinkle). The output is a transparent PNG with no white background. Falls
 * back to the original only if even the in-browser detour fails.
 */
async function processPhoto(dataUrl: string): Promise<{ white: string; cutout?: string }> {
  const transparent = await detour(dataUrl);
  if (!transparent) return { white: dataUrl };
  return finishTransparent(transparent);
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
            const dataUrl = await fileToDataUrl(file); // (1) EXIF-correct, upright
            onChange(dataUrl); // show preview immediately
            setLoading(false);

            // (2–10) detour → layout → de-wrinkle (non-blocking, falls back)
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
          <img src={value} alt="" className="h-full w-full object-contain" />
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
            setProcessing(true);
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
              // "Apply" runs the FULL pipeline (detour → rotate → resize → center
              // → light de-wrinkle), never just a crop/rotation of the original.
              const result = hasAlpha
                ? await finishTransparent(layoutGarment(im)) // already a cut-out → lay out + de-wrinkle
                : await processPhoto(edited); // opaque crop → detour + full pipeline
              onChange(result.white);
              if (result.cutout) onCutout?.(result.cutout);
            } catch {
              onChange(edited);
            } finally {
              setProcessing(false);
            }
          }}
        />
        </ErrorBoundary>
      )}
    </div>
  );
}
