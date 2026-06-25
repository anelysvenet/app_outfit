import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { suggestReplacement } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { outfitId, category, excludeId, occasion } = (await req.json()) as {
      outfitId?: string;
      category?: string;
      excludeId?: string;
      occasion?: string;
    };
    if (!outfitId || !category) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const db = await readDb();
    const outfit = db.outfits.find((o) => o.id === outfitId && o.userId === user.id);
    if (!outfit) return NextResponse.json({ error: "Tenue introuvable" }, { status: 404 });

    const byId = new Map(db.garments.map((g) => [g.id, g]));
    const keep = outfit.items
      .filter((it) => it.garmentId !== excludeId)
      .map((it) => byId.get(it.garmentId))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((g) => ({ type: g.type, colors: g.colors, category: g.category }));

    const candidates = db.garments
      .filter((g) => g.userId === user.id && !g.deleted && g.category === category && g.id !== excludeId)
      .map((g) => ({
        id: g.id,
        type: g.type,
        colors: g.colors,
        material: g.material,
        styles: g.styles,
        category: g.category,
      }));

    if (!candidates.length) {
      return NextResponse.json({ error: "Aucun autre vêtement dans cette catégorie." }, { status: 422 });
    }

    const chosenId = await suggestReplacement({
      keep,
      candidates,
      occasion: occasion || outfit.occasion,
      lang: user.language,
    });
    const garment = chosenId ? byId.get(chosenId) : undefined;
    if (!garment) return NextResponse.json({ error: "Aucune suggestion" }, { status: 422 });

    return NextResponse.json({ garment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggestion impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
