import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, newId, readDb } from "@/lib/db";
import { generateTripOutfits } from "@/lib/ai";
import type { Outfit, WeatherSnapshot } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      destination?: string;
      days?: number;
      occasions?: string[];
      planning?: { day: number; occasion: string }[];
      weather?: WeatherSnapshot | null;
      avoidTitles?: string[];
    };
    const destination = (body.destination || "").trim();
    const days = Math.max(1, Math.min(14, Math.round(body.days || 1)));
    if (!destination) {
      return NextResponse.json({ error: "Destination requise" }, { status: 400 });
    }

    const db = await readDb();
    const wardrobe = db.garments.filter((g) => g.userId === user.id && !g.deleted);
    const styleRefs = db.styleRefs
      .filter((r) => r.userId === user.id)
      .map((r) => ({ description: r.description, colors: r.colors, styles: r.styles }));

    const hasShoes = wardrobe.some((g) => g.category === "chaussures");
    const hasTop = wardrobe.some((g) => ["haut", "veste", "robe", "combinaison"].includes(g.category));
    if (!hasShoes || !hasTop) {
      return NextResponse.json(
        { error: "Garde-robe insuffisante : ajoutez au moins un haut/robe et des chaussures." },
        { status: 400 },
      );
    }

    const generated = await generateTripOutfits({
      user: { styles: user.styles },
      wardrobe,
      weather: body.weather ?? null,
      destination,
      days,
      occasions: Array.isArray(body.occasions) ? body.occasions : [],
      planning: Array.isArray(body.planning) ? body.planning : undefined,
      colorimetry: user.colorimetry
        ? {
            season: user.colorimetry.season,
            undertone: user.colorimetry.undertone,
            palette: user.colorimetry.palette.map((c) => c.name),
            avoid: user.colorimetry.avoid.map((c) => c.name),
          }
        : undefined,
      styleRefs,
      avoidTitles: Array.isArray(body.avoidTitles) ? body.avoidTitles : undefined,
      lang: user.language,
    });

    if (!generated.length) {
      return NextResponse.json(
        { error: "Aucune tenue n'a pu être composée. Enrichissez votre garde-robe." },
        { status: 422 },
      );
    }

    const outfits: Outfit[] = generated.map((g) => ({
      id: newId(),
      userId: user.id,
      title: g.title,
      items: g.items,
      occasion: `${destination} · J${g.day} · ${g.occasion}`,
      weather: body.weather ?? null,
      explanation: g.explanation,
      tips: g.tips,
      evening: /soir/i.test(g.occasion),
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
