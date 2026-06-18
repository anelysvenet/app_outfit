"use client";

import { useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";

async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = document.createElement("img");
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = raw;
  });

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  // Auto-rotate landscape images to portrait (garments often photographed sideways)
  const isLandscape = srcW > srcH * 1.1;
  const outW = isLandscape ? srcH : srcW; // portrait width
  const outH = isLandscape ? srcW : srcH; // portrait height

  const MAX = 1280;
  const scale = Math.min(1, MAX / Math.max(outW, outH));

  if (!isLandscape && scale === 1 && file.size < 2_000_000) return raw;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(outW * scale);
  canvas.height = Math.round(outH * scale);
  const ctx = canvas.getContext("2d")!;

  if (isLandscape) {
    // Rotate 90° clockwise: translate to right edge then rotate
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    // Draw at original landscape dimensions (canvas.height × canvas.width after rotation)
    ctx.drawImage(img, 0, 0, canvas.height, canvas.width);
  } else {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  return canvas.toDataURL("image/jpeg", 0.88);
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
  return canvas.toDataURL("image/jpeg", 0.90);
}

/** Composite a transparent PNG onto a white background with clean, crisp edges. */
async function compositeOnWhite(transparentDataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = transparentDataUrl;
  });

  // Threshold pass: convert semi-transparent fringe to hard edges
  const mask = document.createElement("canvas");
  mask.width = img.naturalWidth;
  mask.height = img.naturalHeight;
  const mctx = mask.getContext("2d")!;
  mctx.drawImage(img, 0, 0);
  const imageData = mctx.getImageData(0, 0, mask.width, mask.height);
  const d = imageData.data;
  for (let i = 3; i < d.length; i += 4) {
    d[i] = d[i] > 20 ? 255 : 0;
  }
  mctx.putImageData(imageData, 0, 0);

  // Composite thresholded garment onto white background
  const out = document.createElement("canvas");
  out.width = mask.width;
  out.height = mask.height;
  const octx = out.getContext("2d")!;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, out.width, out.height);
  octx.filter = "contrast(1.05) saturate(1.08)";
  octx.drawImage(mask, 0, 0);
  octx.filter = "none";

  return out.toDataURL("image/png"); // PNG for artefact-free white background
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
            const dataUrl = await fileToDataUrl(file); // resize + auto-rotate
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
