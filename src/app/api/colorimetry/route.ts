import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { analyzeColorimetry } from "@/lib/ai";
import { parseDataUrl } from "@/lib/storage";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { photoDataUrl } = (await req.json()) as { photoDataUrl?: string };
    if (!photoDataUrl) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }

    // The face photo is only analysed, never stored — only the result is kept.
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    const colorimetry = await analyzeColorimetry(base64, mediaType, user.language);

    await mutateDb((db) => {
      const u = db.users.find((x) => x.id === user.id);
      if (u) u.colorimetry = colorimetry;
    });

    return NextResponse.json({ colorimetry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    await mutateDb((db) => {
      const u = db.users.find((x) => x.id === user.id);
      if (u) u.colorimetry = undefined;
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
