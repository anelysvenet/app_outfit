import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";

export const maxDuration = 60;

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

    // Upload original to Vercel Blob — fal.ai requires a real HTTPS URL
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const imageUrl = await saveImage(base64, mediaType);

    // Background removal via fal.ai birefnet (high quality for clothing)
    const falRes = await fetch("https://fal.run/fal-ai/birefnet", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!falRes.ok) {
      console.error("[birefnet] error:", falRes.status, await falRes.text().catch(() => ""));
      return NextResponse.json({ skipped: true });
    }

    const falData = await falRes.json();
    const resultUrl: string | undefined = falData?.image?.url ?? falData?.images?.[0]?.url;
    if (!resultUrl) {
      console.error("[birefnet] no image in response:", JSON.stringify(falData));
      return NextResponse.json({ skipped: true });
    }

    // Download the transparent PNG
    const pngRes = await fetch(resultUrl);
    if (!pngRes.ok) return NextResponse.json({ skipped: true });

    const pngBuf = Buffer.from(await pngRes.arrayBuffer());
    const transparentBase64 = pngBuf.toString("base64");

    return NextResponse.json({
      transparentDataUrl: `data:image/png;base64,${transparentBase64}`,
    });
  } catch (e) {
    console.error("[garments/process]", e);
    // Graceful fallback: caller will use the original photo
    return NextResponse.json({ skipped: true });
  }
}
