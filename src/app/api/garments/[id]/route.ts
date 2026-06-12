import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { CATEGORIES, type Category, type Garment } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as Partial<Garment>;

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
    return g;
  });

  if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ garment: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;

  await mutateDb((db) => {
    db.garments = db.garments.filter((g) => !(g.id === id && g.userId === user.id));
  });

  return NextResponse.json({ ok: true });
}
