import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { analyzeAndPairItem } from "@/lib/ai";
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

    const db = await readDb();
    const wardrobe = db.garments.filter((g) => g.userId === user.id && !g.deleted);
    if (!wardrobe.length) {
      return NextResponse.json(
        { error: "Ajoutez d'abord des vêtements à votre dressing." },
        { status: 400 },
      );
    }

    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const result = await analyzeAndPairItem(base64, mediaType, wardrobe, user.language);

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
