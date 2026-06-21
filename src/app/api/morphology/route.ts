import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { analyzeMorphology } from "@/lib/ai";
import { parseDataUrl, readUpload } from "@/lib/storage";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    // Use the photo from the request if provided, else the saved silhouette
    const body = (await req.json().catch(() => ({}))) as { photoDataUrl?: string };
    let base64: string;
    let mediaType: string;
    if (body.photoDataUrl?.startsWith("data:")) {
      ({ base64, mediaType } = parseDataUrl(body.photoDataUrl));
    } else if (user.photo) {
      const up = await readUpload(user.photo);
      if (!up) return NextResponse.json({ error: "Photo introuvable" }, { status: 400 });
      ({ base64, mediaType } = up);
    } else {
      return NextResponse.json(
        { error: "Ajoutez d'abord une photo en pied." },
        { status: 400 },
      );
    }

    const morphology = await analyzeMorphology(base64, mediaType, user.language);
    await mutateDb((db) => {
      const u = db.users.find((x) => x.id === user.id);
      if (u) u.morphology = morphology;
    });

    return NextResponse.json({ morphology });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analyse impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
