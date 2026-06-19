"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import { RotateCwIcon, RotateCcwIcon, CropIcon, EraserIcon } from "./icons";

type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function rotate(src: string, dir: "cw" | "ccw"): Promise<string> {
  const img = await loadImg(src);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = h;
  c.height = w;
  const ctx = c.getContext("2d")!;
  if (dir === "cw") {
    ctx.translate(h, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, w);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(img, 0, 0);
  return c.toDataURL("image/png");
}

async function cropTo(src: string, r: Rect): Promise<string> {
  const img = await loadImg(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const nx = Math.round(r.x * W);
  const ny = Math.round(r.y * H);
  const nw = Math.max(1, Math.round(r.w * W));
  const nh = Math.max(1, Math.round(r.h * H));
  const c = document.createElement("canvas");
  c.width = nw;
  c.height = nh;
  c.getContext("2d")!.drawImage(img, nx, ny, nw, nh, 0, 0, nw, nh);
  return c.toDataURL("image/png");
}

const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.1;
// Checkerboard so erased (transparent) areas are visible
const CHECKER =
  "repeating-conic-gradient(#d9d2c7 0% 25%, #f1ece3 0% 50%) 50% / 18px 18px";

export default function PhotoEditor({
  src,
  onApply,
  onClose,
}: {
  src: string;
  onApply: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [working, setWorking] = useState(src);
  const [mode, setMode] = useState<"crop" | "erase">("crop");
  const [rect, setRect] = useState<Rect>(FULL);
  const [brush, setBrush] = useState(26);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; orig: Rect } | null>(null);

  // ── Crop drag (window listeners, rAF-throttled) ──
  useEffect(() => {
    let raf = 0;
    let pending: Rect | null = null;
    const flush = () => {
      raf = 0;
      if (pending) {
        setRect(pending);
        pending = null;
      }
    };
    function onMove(e: PointerEvent) {
      if (!drag.current || !imgRef.current) return;
      e.preventDefault();
      const b = imgRef.current.getBoundingClientRect();
      const dx = (e.clientX - drag.current.sx) / b.width;
      const dy = (e.clientY - drag.current.sy) / b.height;
      let { x, y, w, h } = drag.current.orig;
      const m = drag.current.mode;
      if (m === "move") {
        x = clamp(x + dx, 0, 1 - w);
        y = clamp(y + dy, 0, 1 - h);
      } else {
        if (m.includes("w")) {
          const nx = clamp(x + dx, 0, x + w - MIN);
          w += x - nx;
          x = nx;
        }
        if (m.includes("e")) w = clamp(w + dx, MIN, 1 - x);
        if (m.includes("n")) {
          const ny = clamp(y + dy, 0, y + h - MIN);
          h += y - ny;
          y = ny;
        }
        if (m.includes("s")) h = clamp(h + dy, MIN, 1 - y);
      }
      pending = { x, y, w, h };
      if (!raf) raf = requestAnimationFrame(flush);
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function startDrag(e: React.PointerEvent, m: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { mode: m, sx: e.clientX, sy: e.clientY, orig: { ...rect } };
  }

  // ── Erase canvas ──
  const eraseRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const eraseInitFor = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== "erase") return;
    const cv = eraseRef.current;
    if (!cv || eraseInitFor.current === working) return;
    let cancelled = false;
    (async () => {
      const img = await loadImg(working);
      if (cancelled || !eraseRef.current) return;
      const MAX = 1400;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      cv.width = Math.round(img.naturalWidth * scale);
      cv.height = Math.round(img.naturalHeight * scale);
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      eraseInitFor.current = working;
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, working]);

  function eraseAt(e: React.PointerEvent) {
    const cv = eraseRef.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const sx = cv.width / r.width;
    const x = (e.clientX - r.left) * sx;
    const y = (e.clientY - r.top) * (cv.height / r.height);
    const ctx = cv.getContext("2d")!;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, brush * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  async function doRotate(dir: "cw" | "ccw") {
    setBusy(true);
    try {
      setWorking(await rotate(working, dir));
      setRect(FULL);
      eraseInitFor.current = null; // re-init erase canvas for the rotated image
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    try {
      if (mode === "erase" && eraseRef.current && eraseInitFor.current === working) {
        onApply(eraseRef.current.toDataURL("image/png"));
        return;
      }
      const isFull = rect.x === 0 && rect.y === 0 && rect.w === 1 && rect.h === 1;
      onApply(isFull ? working : await cropTo(working, rect));
    } catch (err) {
      console.error("[PhotoEditor] apply failed:", err);
      onApply(working);
    } finally {
      setBusy(false);
    }
  }

  const handleWrap = "absolute flex h-9 w-9 items-center justify-center";
  const dot = "h-4 w-4 rounded-full border-2 border-white bg-champagne shadow pointer-events-none";
  const toolBtn = (active: boolean) =>
    `flex h-11 w-11 items-center justify-center rounded-full transition cursor-pointer ${
      active ? "bg-champagne text-night" : "bg-white/10 text-ivory hover:bg-white/20"
    }`;

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overscroll-none bg-night/85 p-4 backdrop-blur-sm"
      style={{ touchAction: "none" }}
    >
      <div className="relative inline-block max-h-[64vh] max-w-[88vw]">
        {mode === "crop" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={working}
              alt=""
              draggable={false}
              crossOrigin={working.startsWith("data:") ? undefined : "anonymous"}
              className="block max-h-[64vh] max-w-[88vw] select-none rounded-lg"
            />
            <div
              onPointerDown={(e) => startDrag(e, "move")}
              className="absolute cursor-move"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                boxShadow: "0 0 0 9999px rgba(20,18,16,0.55)",
                border: "1.5px solid rgba(255,255,255,0.9)",
                touchAction: "none",
              }}
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-white/30" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-white/30" />
              </div>
              <div className={`${handleWrap} cursor-nwse-resize`} style={{ left: -18, top: -18, touchAction: "none" }} onPointerDown={(e) => startDrag(e, "nw")}>
                <span className={dot} />
              </div>
              <div className={`${handleWrap} cursor-nesw-resize`} style={{ right: -18, top: -18, touchAction: "none" }} onPointerDown={(e) => startDrag(e, "ne")}>
                <span className={dot} />
              </div>
              <div className={`${handleWrap} cursor-nesw-resize`} style={{ left: -18, bottom: -18, touchAction: "none" }} onPointerDown={(e) => startDrag(e, "sw")}>
                <span className={dot} />
              </div>
              <div className={`${handleWrap} cursor-nwse-resize`} style={{ right: -18, bottom: -18, touchAction: "none" }} onPointerDown={(e) => startDrag(e, "se")}>
                <span className={dot} />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg" style={{ background: CHECKER }}>
            <canvas
              ref={eraseRef}
              onPointerDown={(e) => {
                e.preventDefault();
                painting.current = true;
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                eraseAt(e);
              }}
              onPointerMove={(e) => {
                if (painting.current) eraseAt(e);
              }}
              onPointerUp={() => (painting.current = false)}
              onPointerCancel={() => (painting.current = false)}
              className="block max-h-[64vh] max-w-[88vw] cursor-crosshair touch-none rounded-lg"
            />
          </div>
        )}
      </div>

      {/* Mode + rotation tools */}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={() => setMode("crop")} disabled={busy} className={toolBtn(mode === "crop")} aria-label={t("form.crop")}>
          <CropIcon className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => setMode("erase")} disabled={busy} className={toolBtn(mode === "erase")} aria-label={t("form.erase")}>
          <EraserIcon className="h-5 w-5" />
        </button>

        <div className="mx-1 h-6 w-px bg-white/15" />

        <button type="button" onClick={() => doRotate("ccw")} disabled={busy} className={toolBtn(false)} aria-label={t("form.rotate_left")}>
          <RotateCcwIcon className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => doRotate("cw")} disabled={busy} className={toolBtn(false)} aria-label={t("form.rotate_right")}>
          <RotateCwIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Brush size (erase mode only) */}
      {mode === "erase" && (
        <div className="mt-3 flex items-center gap-3 text-ivory/80">
          <EraserIcon className="h-4 w-4" />
          <input
            type="range"
            min={8}
            max={70}
            value={brush}
            onChange={(e) => setBrush(Number(e.target.value))}
            className="w-40 accent-[#d8c39a]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-5 py-2.5 text-sm text-ivory/80 transition hover:text-ivory cursor-pointer">
          {t("form.cancel")}
        </button>
        <button type="button" onClick={apply} disabled={busy} className="rounded-full bg-champagne px-6 py-2.5 text-sm font-medium text-night transition hover:scale-[1.03] active:scale-[0.98] cursor-pointer">
          {t("form.apply")}
        </button>
      </div>
    </div>
  );
}
