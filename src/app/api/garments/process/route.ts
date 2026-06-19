import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";

export const maxDuration = 60;

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

    // Upload to Vercel Blob (fal.ai requires HTTPS URLs)
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const imageUrl = await saveImage(base64, mediaType);

    // Background removal only — no generative pass, so the garment is NEVER
    // modified (logos, prints and shape stay exactly as the original) and the
    // matte (e.g. the gap between trouser legs) is the model's real alpha.
    const birefRes = await falPost("fal-ai/birefnet", {
      image_url: imageUrl,
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
