import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { analyzeGarmentPhoto } from "@/lib/ai";
import { parseDataUrl } from "@/lib/storage";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { photoDataUrl } = (await req.json()) as { photoDataUrl?: string };
    if (!photoDataUrl) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const analysis = await analyzeGarmentPhoto(base64, mediaType, user.language);
    return NextResponse.json({ analysis });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
