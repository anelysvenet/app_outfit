import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, newId, readDb } from "@/lib/db";
import { analyzeStylePhoto } from "@/lib/ai";
import { parseDataUrl, saveImage } from "@/lib/storage";
import type { StyleRef } from "@/lib/types";

export const maxDuration = 120;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const refs = (await readDb()).styleRefs
      .filter((r) => r.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ styleRefs: refs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { photoDataUrl } = (await req.json()) as { photoDataUrl?: string };
    if (!photoDataUrl) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }

    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const photo = await saveImage(base64, mediaType);

    // Analyse de style (best-effort — la photo reste utile même si l'analyse échoue)
    let analysis: { description?: string; colors?: string[]; styles?: string[] } = {};
    try {
      analysis = await analyzeStylePhoto(base64, mediaType, user.language);
    } catch (e) {
      console.warn("[lookbook] analyzeStylePhoto failed:", e);
    }

    const ref: StyleRef = {
      id: newId(),
      userId: user.id,
      photo,
      description: analysis.description,
      colors: analysis.colors,
      styles: analysis.styles,
      createdAt: new Date().toISOString(),
    };

    await mutateDb((db) => {
      db.styleRefs.push(ref);
    });

    return NextResponse.json({ styleRef: ref });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enregistrement impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
