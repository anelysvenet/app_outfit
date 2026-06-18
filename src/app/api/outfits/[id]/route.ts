import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { id } = await params;
    const body = (await req.json()) as {
      rating?: number;
      items?: { garmentId: string; role: string }[];
    };

    const updated = await mutateDb((db) => {
      const o = db.outfits.find((x) => x.id === id && x.userId === user.id);
      if (!o) return null;
      if (typeof body.rating === "number") {
        o.rating = Math.max(1, Math.min(5, Math.round(body.rating)));
      }
      // Swap garments — validate every id belongs to the user's wardrobe
      if (Array.isArray(body.items)) {
        const ownIds = new Set(
          db.garments.filter((g) => g.userId === user.id).map((g) => g.id),
        );
        const items = body.items
          .filter((it) => it && typeof it.garmentId === "string" && ownIds.has(it.garmentId))
          .map((it) => ({ garmentId: it.garmentId, role: String(it.role ?? "") }));
        if (items.length) {
          o.items = items;
          o.tryOnImage = undefined; // composition changed → stale try-on
        }
      }
      return o;
    });

    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ outfit: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { id } = await params;
    await mutateDb((db) => {
      db.outfits = db.outfits.filter((o) => !(o.id === id && o.userId === user.id));
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
