import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";
import { detectLogos } from "@/lib/ai";

export const maxDuration = 120;

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

/**
 * Generative dewrinkle via FLUX img2img. Strength can be aggressive because the
 * client restores the real logo pixels afterwards. Returns the original URL on
 * any failure so the pipeline degrades gracefully.
 */
async function dewrinkle(imageUrl: string): Promise<string> {
  try {
    const res = await falPost("fal-ai/flux/dev/image-to-image", {
      image_url: imageUrl,
      prompt:
        "the exact same clothing item, fabric perfectly steamed and ironed, completely smooth and wrinkle-free, flat even textile, no creases no folds, same colors same shape same design, professional fashion e-commerce product photography, studio lighting, sharp detail",
      strength: 0.45,
      num_inference_steps: 30,
      guidance_scale: 3.5,
      seed: 42,
    });
    if (!res.ok) {
      console.warn("[flux] dewrinkle error:", res.status, await res.text().catch(() => ""));
      return imageUrl;
    }
    const data = await res.json();
    const smoothedUrl: string | undefined = data?.images?.[0]?.url ?? data?.image?.url;
    if (!smoothedUrl) return imageUrl;
    const dl = await fetch(smoothedUrl);
    if (!dl.ok) return imageUrl;
    const buf = Buffer.from(await dl.arrayBuffer());
    const mime = dl.headers.get("content-type") ?? "image/jpeg";
    return await saveImage(buf.toString("base64"), mime);
  } catch (e) {
    console.warn("[flux] dewrinkle step failed:", e);
    return imageUrl;
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

    // Upload padded image to Vercel Blob (fal.ai requires HTTPS URLs)
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const imageUrl = await saveImage(base64, mediaType);

    // In parallel: locate logos (to restore them later) and dewrinkle the fabric.
    // The generative dewrinkle would alter logos, so the client pastes the real
    // logo pixels back on top using the boxes we return here.
    const [logoBoxes, dewrinkledUrl] = await Promise.all([
      detectLogos(base64, mediaType).catch((e) => {
        console.warn("[detectLogos] failed:", e);
        return [];
      }),
      dewrinkle(imageUrl),
    ]);

    // Background removal — BiRefNet "General Use (Heavy)" for accurate clothing edges
    const birefRes = await falPost("fal-ai/birefnet", {
      image_url: dewrinkledUrl,
      model: "General Use (Heavy)",
    });

    if (!birefRes.ok) {
      console.error("[birefnet] error:", birefRes.status, await birefRes.text().catch(() => ""));
      return NextResponse.json({ skipped: true });
    }

    const birefData = await birefRes.json();
    const resultUrl: string | undefined = birefData?.image?.url ?? birefData?.images?.[0]?.url;
    if (!resultUrl) {
      console.error("[birefnet] no image in response:", JSON.stringify(birefData));
      return NextResponse.json({ skipped: true });
    }

    // Download the transparent PNG and return as base64, with the logo boxes
    const pngRes = await fetch(resultUrl);
    if (!pngRes.ok) return NextResponse.json({ skipped: true });

    const pngBuf = Buffer.from(await pngRes.arrayBuffer());
    return NextResponse.json({
      transparentDataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
      logoBoxes,
    });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
