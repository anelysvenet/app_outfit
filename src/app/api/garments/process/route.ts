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

// Premium e-commerce "steaming" prompt (Zara-like flat lay). Background is
// handled separately by BiRefNet, and logos/buttons are pasted back client-side.
function steamPrompt(kind: string): string {
  const base =
    "Premium e-commerce product photography of the exact same clothing item. " +
    "Keep the garment EXACTLY as it is: preserve the shape, proportions and stitching, " +
    "preserve the exact color and fabric texture, do not redesign or invent details. " +
    "Remove all wrinkles and fold marks (from lying flat) while keeping natural fabric drape, " +
    "smooth the fabric as if professionally steamed. Perfect flat-lay presentation, " +
    "pure white seamless background, soft diffused studio lighting, subtle natural shadow underneath, " +
    "no hanger, no mannequin, no props, ultra sharp, luxury fashion catalog style, 4K.";
  const extra =
    kind === "bottom"
      ? " Straighten both legs. Keep both sides perfectly symmetrical. Remove all fold marks. Maintain crisp seams."
      : kind === "top" || kind === "dress"
        ? " Make the garment look professionally steamed. Straighten the straps. Symmetrize the silhouette. Keep the hems perfectly aligned."
        : "";
  return base + extra;
}

/** Generative "ironing": smooths the fabric. The client restores the real
 *  alpha (from the original) and the real logos, so the matte and prints
 *  stay correct even though FLUX repaints the surface. */
async function dewrinkle(imageUrl: string, prompt: string): Promise<string | null> {
  try {
    const res = await falPost("fal-ai/flux/dev/image-to-image", {
      image_url: imageUrl,
      prompt,
      strength: 0.42,
      num_inference_steps: 32,
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

    // Detect type/logos first (the steaming prompt depends on the garment kind),
    // then steam (FLUX) + matte (BiRefNet on the ORIGINAL) in parallel.
    const detection = await detectLogos(base64, mediaType).catch(() => ({
      logos: [] as { x: number; y: number; w: number; h: number }[],
      ironable: true,
      kind: "other",
    }));
    const [ironedRaw, birefRes] = await Promise.all([
      detection.ironable ? dewrinkle(imageUrl, steamPrompt(detection.kind)) : Promise.resolve(null),
      falPost("fal-ai/birefnet", {
        image_url: imageUrl,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048", // higher res → catches thin gaps (between legs)
        refine_foreground: true,
      }),
    ]);
    const logoBoxes = detection.logos;
    const ironedDataUrl = ironedRaw;

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
