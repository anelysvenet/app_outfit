import { NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";
import { detectLogos } from "@/lib/ai";

export const maxDuration = 120;

// Cap the working resolution for the per-pixel passes.
const PROC_MAX = 1400;

// VERY LIGHT steaming only. The garment is ALREADY detoured and laid out by the
// client; FLUX must not detour, recreate, move or reshape it — just relax the
// wrinkles. Shape is locked by re-applying the original alpha and logos/prints
// are pasted back from the original pixels.
const STEAM_PROMPT = [
  "Lightly steamed garment, gently relax only the wrinkles and creases.",
  "Keep the exact same garment: identical shape, identical colors, identical proportions.",
  "Keep all logos, prints, text, graphics, patterns, labels, embroidery, rhinestones, buttons and stitching perfectly intact and unchanged.",
  "Pure white background. Professional fashion e-commerce product photo. Soft studio lighting. Ultra realistic.",
  "Do not redesign, recreate, replace, move or reshape the garment. Do not remove the background.",
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

/** Generative VERY LIGHT de-wrinkling (FLUX img2img). Returns the image URL. */
async function dewrinkle(imageUrl: string): Promise<string | null> {
  try {
    const res = await falPost("fal-ai/flux/dev/image-to-image", {
      image_url: imageUrl,
      prompt: STEAM_PROMPT,
      strength: 0.22, // very light — just relax wrinkles, keep the garment intact
      num_inference_steps: 28,
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

type LogoBox = { x: number; y: number; w: number; h: number };

/** Paste the ORIGINAL garment pixels back over the de-wrinkled surface inside
 *  each logo box, feathered, so prints stay 100% authentic. */
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

/**
 * Step 10 ONLY: very light de-wrinkling of an ALREADY-detoured transparent
 * garment PNG. Detouring happens client-side (no fal); this endpoint only
 * enhances. Returns the de-wrinkled transparent PNG, or { skipped } if FLUX is
 * unavailable — in which case the client keeps the detoured PNG unchanged.
 */
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

    // Load the detoured transparent PNG as raw RGBA (capped).
    const input = Buffer.from(base64, "base64");
    const meta = await sharp(input).metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
    const scale = longest > PROC_MAX ? PROC_MAX / longest : 1;
    const w = Math.max(1, Math.round((meta.width ?? 0) * scale));
    const h = Math.max(1, Math.round((meta.height ?? 0) * scale));
    const n = w * h;

    const { data } = await sharp(input)
      .resize(w, h, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Original RGB (for logo paste-back) and original alpha (locks the silhouette).
    const orig = Buffer.from(data);

    // Composite the garment on white so FLUX sees a clean product shot.
    const white = Buffer.alloc(n * 4);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const a = data[o + 3] / 255;
      white[o] = Math.round(data[o] * a + 255 * (1 - a));
      white[o + 1] = Math.round(data[o + 1] * a + 255 * (1 - a));
      white[o + 2] = Math.round(data[o + 2] * a + 255 * (1 - a));
      white[o + 3] = 255;
    }
    const whiteJpeg = await sharp(white, { raw: { width: w, height: h, channels: 4 } })
      .jpeg({ quality: 92 })
      .toBuffer();
    const imageUrl = await saveImage(whiteJpeg.toString("base64"), "image/jpeg");

    // Detect logos (best-effort) and whether the garment should be steamed.
    const detection = await detectLogos(whiteJpeg.toString("base64"), "image/jpeg").catch(() => ({
      logos: [] as LogoBox[],
      ironable: true,
      kind: "other",
    }));
    if (!detection.ironable) return NextResponse.json({ skipped: true });

    // FLUX very light de-wrinkle.
    const ironedUrl = await dewrinkle(imageUrl);
    if (!ironedUrl) return NextResponse.json({ skipped: true });
    const ironedBuf = await fetchBuffer(ironedUrl);
    if (!ironedBuf) return NextResponse.json({ skipped: true });

    const ironed = await sharp(ironedBuf)
      .resize(w, h, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer(); // RGB

    // Re-apply the ORIGINAL alpha (keeps the exact silhouette → transparent again)
    // and restore the real logos over the de-wrinkled fabric.
    const out = Buffer.alloc(n * 4);
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const o = i * 4;
      out[o] = ironed[j];
      out[o + 1] = ironed[j + 1];
      out[o + 2] = ironed[j + 2];
      out[o + 3] = orig[o + 3]; // original alpha
    }
    if (detection.logos.length) pasteLogos(out, orig, w, h, detection.logos);

    const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
    return NextResponse.json({ transparentDataUrl: `data:image/png;base64,${png.toString("base64")}` });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
