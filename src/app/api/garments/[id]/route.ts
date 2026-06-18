import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { parseDataUrl, saveImage } from "@/lib/storage";
import { CATEGORIES, type Category, type Garment } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json()) as Partial<Garment> & { photoDataUrl?: string };

    // If the photo was cropped/rotated client-side, persist the new image
    let newPhotoUrl: string | undefined;
    if (body.photoDataUrl?.startsWith("data:")) {
      const { base64, mediaType } = parseDataUrl(body.photoDataUrl);
      newPhotoUrl = await saveImage(base64, mediaType);
    }

    const updated = await mutateDb((db) => {
      const g = db.garments.find((x) => x.id === id && x.userId === user.id);
      if (!g) return null;
      if (body.name !== undefined) g.name = String(body.name).trim();
      if (body.category && CATEGORIES.includes(body.category as Category)) {
        g.category = body.category as Category;
      }
      if (body.type !== undefined) g.type = String(body.type).trim();
      if (body.cut !== undefined) g.cut = String(body.cut).trim();
      if (Array.isArray(body.colors)) g.colors = body.colors.slice(0, 5);
      if (body.material !== undefined) g.material = String(body.material).trim();
      if (Array.isArray(body.seasons)) g.seasons = body.seasons;
      if (Array.isArray(body.styles)) g.styles = body.styles;
      if (body.brand !== undefined) g.brand = String(body.brand).trim() || undefined;
      if (body.description !== undefined) {
        g.description = String(body.description).trim() || undefined;
      }
      if (body.evening !== undefined) g.evening = Boolean(body.evening);
      if (newPhotoUrl) g.photo = newPhotoUrl;
      // Restore from trash
      if ((body as { restore?: boolean }).restore) {
        g.deleted = false;
        g.deletedAt = undefined;
      }
      return g;
    });

    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ garment: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { id } = await params;
    const permanent = new URL(req.url).searchParams.get("permanent") === "1";

    await mutateDb((db) => {
      if (permanent) {
        // Hard delete — remove from the database for good
        db.garments = db.garments.filter((g) => !(g.id === id && g.userId === user.id));
      } else {
        // Soft delete — move to trash so it can be restored
        const g = db.garments.find((x) => x.id === id && x.userId === user.id);
        if (g) {
          g.deleted = true;
          g.deletedAt = new Date().toISOString();
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
