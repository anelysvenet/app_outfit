import sharp from "sharp";
import { analyzeShoeOrientation } from "./ai";

const PROC_MAX = 1400;

/** Flood near-PURE-white (or already-transparent) pixels from the borders to
 *  alpha 0, so a legacy white-bg shoe photo becomes transparent. */
function openBackground(d: Buffer, w: number, h: number) {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const removable = (p: number) => {
    const o = p * 4;
    return d[o + 3] < 30 || (d[o] > 248 && d[o + 1] > 248 && d[o + 2] > 248);
  };
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
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

/**
 * Brings a shoe image to the mandatory layout: side profile, horizontal, toe to
 * the RIGHT, heel LEFT, centered in a landscape transparent canvas with a margin.
 * Proportions are preserved (rotation/mirror only, never stretched). Returns a
 * white-bg photo + a transparent cut-out as data URLs, or null on failure.
 *
 * Note: only rotation + horizontal mirror are applied — a true top/front view
 * cannot be turned into a real side profile without regenerating the shoe.
 */
export async function orientShoeImage(
  base64: string,
  mediaType: string,
): Promise<{ photoDataUrl: string; cutoutDataUrl: string } | null> {
  try {
    const orient = await analyzeShoeOrientation(base64, mediaType);

    // Apply the rotation (+ optional horizontal mirror) on the original bytes.
    let pipe = sharp(Buffer.from(base64, "base64")).rotate(Number(orient.rotate));
    if (orient.flipHorizontal) pipe = pipe.flop();

    // Cap working resolution.
    const meta = await pipe.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longest > PROC_MAX) {
      const s = PROC_MAX / longest;
      pipe = pipe.resize(Math.round((meta.width ?? 0) * s), Math.round((meta.height ?? 0) * s), {
        fit: "inside",
      });
    }

    const { data, info } = await pipe.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const n = w * h;

    // If the image is fully opaque (legacy white-bg), cut the white background.
    let opaque = true;
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] < 250) { opaque = false; break; }
    }
    if (opaque) openBackground(data, w, h);

    // Bounding box of the garment.
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let i = 0; i < n; i++) {
      if (data[i * 4 + 3] > 30) {
        const x = i % w;
        const y = (i - x) / w;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // Crop + uniform margin, centered (landscape because a side-profile shoe is
    // wider than tall).
    const margin = Math.round(Math.max(bw, bh) * 0.08);
    const cw = bw + margin * 2;
    const ch = bh + margin * 2;
    const cut = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < bh; y++) {
      const srcRow = ((minY + y) * w + minX) * 4;
      const dstRow = ((y + margin) * cw + margin) * 4;
      data.copy(cut, dstRow, srcRow, srcRow + bw * 4);
    }

    // White-bg version (required field / try-on).
    const white = Buffer.alloc(cw * ch * 4);
    for (let i = 0; i < cut.length; i += 4) {
      const a = cut[i + 3] / 255;
      white[i] = Math.round(cut[i] * a + 255 * (1 - a));
      white[i + 1] = Math.round(cut[i + 1] * a + 255 * (1 - a));
      white[i + 2] = Math.round(cut[i + 2] * a + 255 * (1 - a));
      white[i + 3] = 255;
    }

    const [cutoutPng, whitePng] = await Promise.all([
      sharp(cut, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer(),
      sharp(white, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer(),
    ]);

    return {
      photoDataUrl: `data:image/png;base64,${whitePng.toString("base64")}`,
      cutoutDataUrl: `data:image/png;base64,${cutoutPng.toString("base64")}`,
    };
  } catch (e) {
    console.warn("[orientShoeImage] failed:", e);
    return null;
  }
}
