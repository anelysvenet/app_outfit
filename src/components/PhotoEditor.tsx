"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/contexts/LanguageContext";
import { RotateCwIcon, RotateCcwIcon } from "./icons";

type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
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
  const [rect, setRect] = useState<Rect>(FULL);
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; orig: Rect } | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current || !imgRef.current) return;
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
      setRect({ x, y, w, h });
    }
    function onUp() {
      drag.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function startDrag(e: React.PointerEvent, mode: string) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, sx: e.clientX, sy: e.clientY, orig: { ...rect } };
  }

  async function doRotate(dir: "cw" | "ccw") {
    setBusy(true);
    try {
      setWorking(await rotate(working, dir));
      setRect(FULL);
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    setBusy(true);
    try {
      const isFull = rect.x === 0 && rect.y === 0 && rect.w === 1 && rect.h === 1;
      const result = isFull ? working : await cropTo(working, rect);
      onApply(result);
    } finally {
      setBusy(false);
    }
  }

  const handle =
    "absolute h-4 w-4 rounded-full border-2 border-white bg-champagne shadow";

  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-night/85 p-4 backdrop-blur-sm">
      <div className="relative inline-block max-h-[68vh] max-w-[88vw]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={working}
          alt=""
          draggable={false}
          className="block max-h-[68vh] max-w-[88vw] select-none rounded-lg"
        />
        {/* Crop rectangle with dimmed exterior */}
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
          }}
        >
          {/* thirds guides */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
            <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
            <div className="absolute top-1/3 left-0 w-full h-px bg-white/30" />
            <div className="absolute top-2/3 left-0 w-full h-px bg-white/30" />
          </div>
          {/* corner handles */}
          <div
            className={`${handle} cursor-nwse-resize`}
            style={{ left: -8, top: -8 }}
            onPointerDown={(e) => startDrag(e, "nw")}
          />
          <div
            className={`${handle} cursor-nesw-resize`}
            style={{ right: -8, top: -8 }}
            onPointerDown={(e) => startDrag(e, "ne")}
          />
          <div
            className={`${handle} cursor-nesw-resize`}
            style={{ left: -8, bottom: -8 }}
            onPointerDown={(e) => startDrag(e, "sw")}
          />
          <div
            className={`${handle} cursor-nwse-resize`}
            style={{ right: -8, bottom: -8 }}
            onPointerDown={(e) => startDrag(e, "se")}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => doRotate("ccw")}
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-ivory transition hover:bg-white/20 cursor-pointer"
          aria-label={t("form.rotate_left")}
        >
          <RotateCcwIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => doRotate("cw")}
          disabled={busy}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-ivory transition hover:bg-white/20 cursor-pointer"
          aria-label={t("form.rotate_right")}
        >
          <RotateCwIcon className="h-5 w-5" />
        </button>

        <div className="mx-2 h-6 w-px bg-white/15" />

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-full px-5 py-2.5 text-sm text-ivory/80 transition hover:text-ivory cursor-pointer"
        >
          {t("form.cancel")}
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={busy}
          className="rounded-full bg-champagne px-6 py-2.5 text-sm font-medium text-night transition hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
        >
          {t("form.apply")}
        </button>
      </div>
    </div>
  );
}
