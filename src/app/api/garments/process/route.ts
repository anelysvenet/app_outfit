import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";

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

    // 1. Upload padded image to Vercel Blob (fal.ai requires HTTPS URLs)
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const imageUrl = await saveImage(base64, mediaType);

    // 2. Dewrinkle via FLUX image-to-image (low strength preserves garment design)
    let processedUrl = imageUrl;
    try {
      const fluxRes = await falPost("fal-ai/flux/dev/image-to-image", {
        image_url: imageUrl,
        prompt:
          "smooth fabric clothing product photography, wrinkle-free textile, flat crisp fabric, professional fashion catalog, clean studio lighting, commercial clothing shoot",
        strength: 0.25,
        num_inference_steps: 20,
        guidance_scale: 3.5,
        seed: 42,
      });
      if (fluxRes.ok) {
        const fluxData = await fluxRes.json();
        const smoothedUrl: string | undefined = fluxData?.images?.[0]?.url;
        if (smoothedUrl) {
          const smoothedRes = await fetch(smoothedUrl);
          if (smoothedRes.ok) {
            const smoothedBuf = Buffer.from(await smoothedRes.arrayBuffer());
            const smoothedMime = smoothedRes.headers.get("content-type") ?? "image/jpeg";
            processedUrl = await saveImage(smoothedBuf.toString("base64"), smoothedMime);
          }
        }
      } else {
        console.warn("[flux] dewrinkle error:", fluxRes.status, await fluxRes.text().catch(() => ""));
      }
    } catch (e) {
      console.warn("[flux] dewrinkle step failed, continuing with original:", e);
    }

    // 3. Background removal — BiRefNet "General Use (Heavy)" for accurate clothing edges
    const birefRes = await falPost("fal-ai/birefnet", {
      image_url: processedUrl,
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

    // 4. Download the transparent PNG and return as base64
    const pngRes = await fetch(resultUrl);
    if (!pngRes.ok) return NextResponse.json({ skipped: true });

    const pngBuf = Buffer.from(await pngRes.arrayBuffer());
    return NextResponse.json({
      transparentDataUrl: `data:image/png;base64,${pngBuf.toString("base64")}`,
    });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
