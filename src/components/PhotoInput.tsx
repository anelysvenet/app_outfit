"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import PhotoEditor from "./PhotoEditor";
import LogoLoader from "./LogoLoader";
import ErrorBoundary from "./ErrorBoundary";
import { CropIcon } from "./icons";

/**
 * Decode a file with EXIF orientation already applied (consistent across browsers)
 * and downscale. The server pipeline also auto-orients, so the image is upright
 * everywhere.
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

/** Add a neutral contrasting border so garment edges never touch the frame (prevents API clipping). */
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
  ctx.fillStyle = "#8a8a8a"; // neutral mid-grey — distinct from black, navy AND white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, px, py);
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
 * Real background removal. The server does the whole pipeline (auto-orient →
 * matte → keep the garment → white background → light steaming) and returns the
 * finished images as data URLs. Returns { white, cutout }; falls back to the
 * original on any error.
 */
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
    if (data.skipped || !data.photoDataUrl) return { white: dataUrl };
    return { white: data.photoDataUrl, cutout: data.cutoutDataUrl ?? undefined };
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
                // Manual erase: respect the user's cut-out. Keep it transparent for
                // the render and make a white-bg version for grids / try-on.
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
                // Crop / rotation: re-run the real detouring pipeline so the result
                // is the final processed image, not just the cropped one.
                onChange(edited); // immediate preview while it processes
                setProcessing(true);
                try {
                  const processed = await processPhoto(edited);
                  onChange(processed.white);
                  if (processed.cutout) onCutout?.(processed.cutout);
                } finally {
                  setProcessing(false);
                }
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
