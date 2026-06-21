"use client";

import { useEffect, useState } from "react";

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/**
 * Renders a garment with its white studio background removed (flood-fill from
 * the edges), so it appears truly cut out on the app background. Interior white
 * (e.g. a white top) is preserved because only border-connected white is cleared.
 * Used as a fallback for garments saved before the transparent cut-out existed.
 */
export default function CutoutImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [out, setOut] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const img = await loadImg(src);
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, w, h);
        const d = id.data;
        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        // Only near-PURE white (studio backdrop / leftover box) is treated as
        // background — real, slightly-shaded white garments are preserved.
        const isWhite = (p: number) =>
          d[p * 4 + 3] > 10 &&
          d[p * 4] > 248 &&
          d[p * 4 + 1] > 248 &&
          d[p * 4 + 2] > 248;
        for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const p = stack.pop()!;
          if (seen[p]) continue;
          seen[p] = 1;
          if (!isWhite(p)) continue;
          d[p * 4 + 3] = 0;
          const x = p % w;
          const y = (p - x) / w;
          if (x > 0) stack.push(p - 1);
          if (x < w - 1) stack.push(p + 1);
          if (y > 0) stack.push(p - w);
          if (y < h - 1) stack.push(p + w);
        }
        ctx.putImageData(id, 0, 0);
        if (!cancelled) setOut(c.toDataURL("image/png"));
      } catch {
        if (!cancelled) setOut(src);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={out ?? src} alt={alt} className={className} />;
}
