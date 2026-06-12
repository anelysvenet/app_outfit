import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, newId, readDb } from "@/lib/db";
import { generateOutfits } from "@/lib/ai";
import type { Outfit, WeatherSnapshot } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      occasion?: string;
      evening?: boolean;
      weather?: WeatherSnapshot | null;
    };

    const db = await readDb();
    const wardrobe = db.garments.filter((g) => g.userId === user.id);
    const ratedOutfits = db.outfits.filter(
      (o) => o.userId === user.id && typeof o.rating === "number",
    );

    const hasTopBottom =
      wardrobe.some((g) => g.category === "haut") &&
      wardrobe.some((g) => g.category === "bas");
    const hasDress = wardrobe.some((g) => g.category === "robe");
    const hasShoes = wardrobe.some((g) => g.category === "chaussures");

    if ((!hasTopBottom && !hasDress) || !hasShoes) {
      return NextResponse.json(
        {
          error:
            "Garde-robe insuffisante : ajoutez au moins un haut et un bas (ou une robe), et une paire de chaussures.",
        },
        { status: 400 },
      );
    }

    const generated = await generateOutfits({
      user: { styles: user.styles },
      wardrobe,
      weather: body.weather ?? null,
      occasion: body.occasion || "Décontracté",
      evening: Boolean(body.evening),
      ratedOutfits,
    });

    if (!generated.length) {
      return NextResponse.json(
        { error: "Aucune tenue cohérente n'a pu être composée. Enrichissez votre garde-robe." },
        { status: 422 },
      );
    }

    const outfits: Outfit[] = generated.map((g) => ({
      id: newId(),
      userId: user.id,
      title: g.title,
      items: g.items,
      occasion: body.occasion || "Décontracté",
      weather: body.weather ?? null,
      explanation: g.explanation,
      tips: g.tips,
      evening: Boolean(body.evening),
      createdAt: new Date().toISOString(),
    }));

    await mutateDb((d) => {
      d.outfits.push(...outfits);
    });

    return NextResponse.json({ outfits });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Génération impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
