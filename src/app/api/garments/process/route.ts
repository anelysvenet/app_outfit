import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";
import { detectLogos } from "@/lib/ai";

export const maxDuration = 120;

// Cap the working resolution for the per-pixel passes. 1600px is plenty sharp.
const PROC_MAX = 1600;

// The user's Zara-style steaming prompt, hardened with identity-preserving
// instructions. Shape is locked by the original matte (alpha) and logos/prints
// are pasted back from the original, so FLUX only relaxes the wrinkles.
const STEAM_PROMPT = [
  "Luxury fashion e-commerce product photography.",
  "Invisible mannequin / perfect flat lay.",
  "Pure white seamless background.",
  "Soft diffused studio lighting.",
  "Perfectly steamed garment, smooth fabric, no wrinkles, no creases.",
  "High-end apparel catalog. No hanger. No mannequin. No props. Natural shadows only. Ultra realistic.",
  "Keep the exact same garment: identical shape, identical colors, identical proportions.",
  "Keep all logos, prints, text, graphics, patterns, labels, embroidery, rhinestones, buttons and stitching perfectly intact and unchanged.",
  "Do not redesign, recreate or replace the garment. Only relax accidental wrinkles.",
].join(" ");

async function falPost(endpoint: string, body: object): Promise<Response> {
  return fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function fetchBuffer(url: string): Promise<Buffer | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

/** Generative steaming (smooths wrinkles). The garment's silhouette is restored
 *  later from the original matte and the logos are pasted back, so identity is
 *  preserved even though FLUX repaints the surface. Returns the image URL. */
async function dewrinkle(imageUrl: string): Promise<string | null> {
  try {
    const res = await falPost("fal-ai/flux/dev/image-to-image", {
      image_url: imageUrl,
      prompt: STEAM_PROMPT,
      strength: 0.5, // enough to relax bed/table wrinkles; shape is locked by the matte
      num_inference_steps: 30,
      guidance_scale: 3.5,
      seed: 42,
    });
    if (!res.ok) {
      console.warn("[flux] dewrinkle error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    return data?.images?.[0]?.url ?? data?.image?.url ?? null;
  } catch (e) {
    console.warn("[flux] dewrinkle failed:", e);
    return null;
  }
}

/** Real background removal via fal.ai BiRefNet (dedicated matting model). */
async function birefnet(imageUrl: string): Promise<string | null> {
  const res = await falPost("fal-ai/birefnet", {
    image_url: imageUrl,
    model: "General Use (Heavy)",
    operating_resolution: "2048x2048", // higher res → catches thin gaps (between legs)
    refine_foreground: true,
  });
  if (!res.ok) {
    console.error("[birefnet] error:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.image?.url ?? data?.images?.[0]?.url ?? null;
}

/**
 * Make background-connected pixels transparent. Flows from the border through
 * already-transparent + near-PURE-white pixels, so leftover backdrop the matte
 * missed (e.g. the gap between trouser legs, reachable via the hems) is removed.
 * Interior white enclosed by the garment is preserved.
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

/** Keep only the largest connected opaque region; returns its label map. */
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

/** Paste the ORIGINAL garment pixels (from the un-ironed matte) back over the
 *  ironed surface inside each logo box, feathered, so prints stay 100% authentic. */
function pasteLogos(out: Buffer, orig: Buffer, w: number, h: number, boxes: LogoBox[]) {
  for (const b of boxes) {
    const x0 = Math.max(0, Math.round(b.x * w));
    const y0 = Math.max(0, Math.round(b.y * h));
    const bw = Math.min(w - x0, Math.round(b.w * w));
    const bh = Math.min(h - y0, Math.round(b.h * h));
    if (bw <= 0 || bh <= 0) continue;
    const fm = Math.max(2, Math.min(bw, bh) * 0.16);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const edge = Math.min(x, y, bw - 1 - x, bh - 1 - y);
        const f = Math.max(0, Math.min(1, edge / fm));
        const o = ((y0 + y) * w + (x0 + x)) * 4;
        out[o] = out[o] * (1 - f) + orig[o] * f;
        out[o + 1] = out[o + 1] * (1 - f) + orig[o + 1] * f;
        out[o + 2] = out[o + 2] * (1 - f) + orig[o + 2] * f;
      }
    }
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

    // 1 + 2. Auto-detect EXIF orientation and bake in the rotation.
    const oriented = await sharp(Buffer.from(base64, "base64"))
      .rotate()
      .jpeg({ quality: 92 })
      .toBuffer();
    const orientedB64 = oriented.toString("base64");
    const imageUrl = await saveImage(orientedB64, "image/jpeg");

    // Detect logos + whether the garment should be ironed (skip for e.g. knitwear
    // where steaming makes no sense), then steam + matte in parallel.
    const detection = await detectLogos(orientedB64, "image/jpeg").catch(() => ({
      logos: [] as LogoBox[],
      ironable: true,
      kind: "other",
    }));
    const [ironedUrl, cutUrl] = await Promise.all([
      detection.ironable ? dewrinkle(imageUrl) : Promise.resolve(null),
      birefnet(imageUrl),
    ]);

    // BiRefNet is the hard requirement — without a matte there is no detouring.
    if (!cutUrl) return NextResponse.json({ skipped: true });
    const matted = await fetchBuffer(cutUrl);
    if (!matted) return NextResponse.json({ skipped: true });

    // Canonical working size from the matte, capped.
    const meta = await sharp(matted).metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    const scale = longest > PROC_MAX ? PROC_MAX / longest : 1;
    const w = Math.max(1, Math.round((meta.width ?? 0) * scale));
    const h = Math.max(1, Math.round((meta.height ?? 0) * scale));
    const n = w * h;

    // Matte = ORIGINAL garment RGB + true alpha (defines the exact silhouette).
    const { data } = await sharp(matted)
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Keep a copy of the original RGB (for logo paste-back).
    const orig = Buffer.from(data);

    // Overlay the ironed RGB inside the silhouette (alpha stays from the matte).
    if (ironedUrl) {
      const ironedBuf = await fetchBuffer(ironedUrl);
      if (ironedBuf) {
        const ironed = await sharp(ironedBuf)
          .resize(w, h, { fit: "fill" })
          .removeAlpha()
          .raw()
          .toBuffer(); // RGB, 3 channels
        for (let i = 0, j = 0; i < n; i++, j += 3) {
          const o = i * 4;
          data[o] = ironed[j];
          data[o + 1] = ironed[j + 1];
          data[o + 2] = ironed[j + 2];
        }
        // Restore the real logos/prints over the ironed fabric.
        if (detection.logos.length) pasteLogos(data, orig, w, h, detection.logos);
      }
    }

    // Keep only the garment: cut leftover border bg, binarise alpha, largest blob.
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
    if (maxX < 0) return NextResponse.json({ skipped: true });

    // Crop tightly to the garment + a small uniform margin (no rotation).
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const margin = Math.round(Math.max(bw, bh) * 0.05);
    const cw = bw + margin * 2;
    const ch = bh + margin * 2;

    // Transparent cut-out (zero-filled = transparent margin) — blends with the app.
    const cut = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < bh; y++) {
      const srcRow = ((minY + y) * w + minX) * 4;
      const dstRow = ((y + margin) * cw + margin) * 4;
      data.copy(cut, dstRow, srcRow, srcRow + bw * 4);
    }

    // White-background version (for try-on / required field).
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

    return NextResponse.json({
      // photo = white-bg (required field / try-on); cutout = transparent (display)
      photoDataUrl: `data:image/png;base64,${whitePng.toString("base64")}`,
      cutoutDataUrl: `data:image/png;base64,${cutoutPng.toString("base64")}`,
    });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
