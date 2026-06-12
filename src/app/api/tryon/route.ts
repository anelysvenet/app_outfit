import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { generateTryOn, tryOnAvailable } from "@/lib/tryon";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  if (!user.photo) {
    return NextResponse.json(
      { error: "Ajoutez d'abord une photo en pied dans votre profil." },
      { status: 400 },
    );
  }

  if (!tryOnAvailable()) {
    return NextResponse.json({ available: false, image: null });
  }

  try {
    const { outfitId } = (await req.json()) as { outfitId?: string };
    const db = await readDb();
    const outfit = db.outfits.find((o) => o.id === outfitId && o.userId === user.id);
    if (!outfit) {
      return NextResponse.json({ error: "Tenue introuvable" }, { status: 404 });
    }
    const garments = outfit.items
      .map((it) => db.garments.find((g) => g.id === it.garmentId))
      .filter((g): g is NonNullable<typeof g> => Boolean(g));

    const image = await generateTryOn(user.photo, garments);
    if (image) {
      await mutateDb((d) => {
        const o = d.outfits.find((x) => x.id === outfit.id);
        if (o) o.tryOnImage = image;
      });
    }
    return NextResponse.json({ available: true, image });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Essayage impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
