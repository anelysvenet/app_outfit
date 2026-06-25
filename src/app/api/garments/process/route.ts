import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";

export const maxDuration = 120;

// Cap the working resolution for the per-pixel passes (flood fill / labelling).
// 1600px is plenty sharp for the app and keeps memory/time reasonable.
const PROC_MAX = 1600;

/**
 * Real background removal via fal.ai BiRefNet (a dedicated matting model — NOT a
 * generative prompt). Returns the URL of the transparent cut-out, or null.
 */
async function birefnet(imageUrl: string): Promise<string | null> {
  const res = await fetch("https://fal.run/fal-ai/birefnet", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      model: "General Use (Heavy)",
      operating_resolution: "2048x2048", // higher res → catches thin gaps (between legs)
      refine_foreground: true,
    }),
  });
  if (!res.ok) {
    console.error("[birefnet] error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.image?.url ?? data?.images?.[0]?.url ?? null;
}

/**
 * Make background-connected pixels transparent. Starts from the image border and
 * flows through already-transparent + near-PURE-white pixels, so any leftover
 * studio backdrop the matte missed — typically the gap BETWEEN trouser legs,
 * reachable through the hem opening — gets cut out. Interior white enclosed by the
 * garment (e.g. a white top) is preserved because it isn't border-connected.
 */
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
 * Keep only the largest connected opaque region; returns its label map so callers
 * can strip stray pieces (e.g. a second garment sitting next to the main item).
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

/**
 * Optional, NON-generative "steaming": edge-preserving smoothing applied only
 * AFTER detouring. A pixel is averaged toward a blurred copy only in low-contrast
 * areas (soft wrinkle shadows); strong edges (logos, prints, seams, stitching) are
 * left untouched. It never invents pixels, so colours, prints and shape stay
 * faithful — it merely relaxes accidental bed/table creases.
 */
function smoothFabric(rgba: Buffer, blurred: Buffer) {
  const amount = 0.45; // gentle — "léger lissage", never a flat AI look
  const thr = 42; // above this contrast, detail is preserved
  for (let i = 0; i < rgba.length; i += 4) {
    const de =
      Math.abs(rgba[i] - blurred[i]) +
      Math.abs(rgba[i + 1] - blurred[i + 1]) +
      Math.abs(rgba[i + 2] - blurred[i + 2]);
    const a = Math.max(0, 1 - de / thr) * amount;
    rgba[i] = rgba[i] * (1 - a) + blurred[i] * a;
    rgba[i + 1] = rgba[i + 1] * (1 - a) + blurred[i + 1] * a;
    rgba[i + 2] = rgba[i + 2] * (1 - a) + blurred[i + 2] * a;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ skipped: true });
  }

  try {
    const { photoDataUrl } = (await req.json()) as { photoDataUrl?: string };
    if (!photoDataUrl) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }

    const { base64 } = parseDataUrl(photoDataUrl);

    // 1 + 2. Auto-detect EXIF orientation and bake in the rotation, so the matte
    // model and every downstream step see an upright image.
    const oriented = await sharp(Buffer.from(base64, "base64"))
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer();
    const imageUrl = await saveImage(oriented.toString("base64"), "image/jpeg");

    // 3. Real background removal (dedicated matting model, no prompt / no img2img).
    const cutUrl = await birefnet(imageUrl);
    if (!cutUrl) return NextResponse.json({ skipped: true });
    const cutRes = await fetch(cutUrl);
    if (!cutRes.ok) return NextResponse.json({ skipped: true });
    const matted = Buffer.from(await cutRes.arrayBuffer());

    // Load the cut-out as raw RGBA, capped to the working resolution.
    const meta = await sharp(matted).metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    let loader = sharp(matted);
    if (longest > PROC_MAX) {
      const s = PROC_MAX / longest;
      loader = loader.resize(
        Math.round((meta.width ?? 0) * s),
        Math.round((meta.height ?? 0) * s),
        { fit: "fill" },
      );
    }
    const { data, info } = await loader.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const n = w * h;

    // 4. Keep only the garment: cut leftover border background, binarise the alpha
    // for crisp edges, keep the largest connected region, strip everything else.
    openBackground(data, w, h);
    const alpha = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = data[i * 4 + 3] > 30 ? 1 : 0;
      alpha[i] = a;
      data[i * 4 + 3] = a ? 255 : 0;
    }
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
        data[i * 4 + 3] = 0; // strip stray pieces
      }
    }
    if (maxX < 0) return NextResponse.json({ skipped: true }); // nothing detected

    // Crop tightly to the garment + a small uniform margin (no rotation, so the
    // garment keeps its real orientation; object-contain shows the whole piece).
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const margin = Math.round(Math.max(bw, bh) * 0.05);
    const cw = bw + margin * 2;
    const ch = bh + margin * 2;

    // Cropped transparent cut-out (zero-filled buffer = transparent margin).
    const cut = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < bh; y++) {
      const srcRow = ((minY + y) * w + minX) * 4;
      const dstRow = ((y + margin) * cw + margin) * 4;
      data.copy(cut, dstRow, srcRow, srcRow + bw * 4);
    }

    // 5. White-background compositing — flatten the garment over pure white #FFFFFF.
    const white = Buffer.alloc(cw * ch * 4);
    for (let i = 0; i < cut.length; i += 4) {
      const a = cut[i + 3] / 255;
      white[i] = Math.round(cut[i] * a + 255 * (1 - a));
      white[i + 1] = Math.round(cut[i + 1] * a + 255 * (1 - a));
      white[i + 2] = Math.round(cut[i + 2] * a + 255 * (1 - a));
      white[i + 3] = 255;
    }

    // 9. Optional light steaming AFTER detouring (edge-preserving, non-generative).
    const sigma = Math.max(0.6, Math.min(cw, ch) * 0.006);
    const blurred = await sharp(white, { raw: { width: cw, height: ch, channels: 4 } })
      .blur(sigma)
      .raw()
      .toBuffer();
    smoothFabric(white, blurred);
    // Re-apply the real alpha to derive the matching smoothed cut-out.
    for (let i = 0; i < cut.length; i += 4) {
      cut[i] = white[i];
      cut[i + 1] = white[i + 1];
      cut[i + 2] = white[i + 2];
    }

    const [whitePng, cutoutPng] = await Promise.all([
      sharp(white, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer(),
      sharp(cut, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer(),
    ]);

    return NextResponse.json({
      photoDataUrl: `data:image/png;base64,${whitePng.toString("base64")}`,
      cutoutDataUrl: `data:image/png;base64,${cutoutPng.toString("base64")}`,
    });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
