import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, newId, readDb } from "@/lib/db";
import { parseDataUrl, saveImage } from "@/lib/storage";
import { CATEGORIES, type Category, type Garment } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const garments = (await readDb())
      .garments.filter((g) => g.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ garments });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const body = (await req.json()) as Partial<Garment> & { photoDataUrl?: string };
    if (!body.photoDataUrl) {
      return NextResponse.json({ error: "Photo requise" }, { status: 400 });
    }
    if (!body.category || !CATEGORIES.includes(body.category as Category)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }

    const { base64, mediaType } = parseDataUrl(body.photoDataUrl);
    const photo = await saveImage(base64, mediaType);

    const garment: Garment = {
      id: newId(),
      userId: user.id,
      photo,
      name: body.name?.trim() || "Vêtement",
      category: body.category as Category,
      type: body.type?.trim() || "",
      cut: body.cut?.trim() || "",
      colors: Array.isArray(body.colors) ? body.colors.slice(0, 5) : [],
      material: body.material?.trim() || "",
      seasons: Array.isArray(body.seasons) ? body.seasons : [],
      styles: Array.isArray(body.styles) ? body.styles : [],
      brand: body.brand?.trim() || undefined,
      description: body.description?.trim() || undefined,
      evening: Boolean(body.evening),
      createdAt: new Date().toISOString(),
    };

    await mutateDb((db) => {
      db.garments.push(garment);
    });

    return NextResponse.json({ garment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Enregistrement impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
