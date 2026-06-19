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

async function toBase64(url: string): Promise<string | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const mime = r.headers.get("content-type") ?? "image/png";
  return `data:${mime};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
}

/** Generative "ironing": smooths the fabric. The client restores the real
 *  alpha (from the original) and the real logos, so the matte and prints
 *  stay correct even though FLUX repaints the surface. */
async function dewrinkle(imageUrl: string): Promise<string | null> {
  try {
    const res = await falPost("fal-ai/flux/dev/image-to-image", {
      image_url: imageUrl,
      prompt:
        "the exact same clothing item, fabric perfectly ironed and steamed, completely smooth, wrinkle-free, flat even textile, no creases no folds, identical color shape and design, professional fashion e-commerce product photo on plain background, sharp focus",
      strength: 0.38,
      num_inference_steps: 30,
      guidance_scale: 3.5,
      seed: 42,
    });
    if (!res.ok) {
      console.warn("[flux] dewrinkle error:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const url: string | undefined = data?.images?.[0]?.url ?? data?.image?.url;
    return url ? await toBase64(url) : null;
  } catch (e) {
    console.warn("[flux] dewrinkle failed:", e);
    return null;
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

    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const imageUrl = await saveImage(base64, mediaType);

    // In parallel: logos + ironability, ironed RGB (FLUX), and the matte/alpha
    // computed on the ORIGINAL (so the gap between trouser legs stays cut out).
    const [detection, ironedRaw, birefRes] = await Promise.all([
      detectLogos(base64, mediaType).catch(() => ({ logos: [], ironable: true })),
      dewrinkle(imageUrl),
      falPost("fal-ai/birefnet", {
        image_url: imageUrl,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048", // higher res → catches thin gaps (between legs)
        refine_foreground: true,
      }),
    ]);
    const logoBoxes = detection.logos;
    // Don't iron bags, shoes, leather goods, jewelry… — keep them as-is
    const ironedDataUrl = detection.ironable ? ironedRaw : null;

    if (!birefRes.ok) {
      console.error("[birefnet] error:", birefRes.status, await birefRes.text().catch(() => ""));
      return NextResponse.json({ skipped: true });
    }
    const birefData = await birefRes.json();
    const resultUrl: string | undefined = birefData?.image?.url ?? birefData?.images?.[0]?.url;
    if (!resultUrl) {
      console.error("[birefnet] no image:", JSON.stringify(birefData));
      return NextResponse.json({ skipped: true });
    }
    const transparentDataUrl = await toBase64(resultUrl);
    if (!transparentDataUrl) return NextResponse.json({ skipped: true });

    return NextResponse.json({ transparentDataUrl, ironedDataUrl, logoBoxes });
  } catch (e) {
    console.error("[garments/process]", e);
    return NextResponse.json({ skipped: true });
  }
}
