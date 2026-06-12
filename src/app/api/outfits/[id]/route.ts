import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as { rating?: number };

  const updated = await mutateDb((db) => {
    const o = db.outfits.find((x) => x.id === id && x.userId === user.id);
    if (!o) return null;
    if (typeof body.rating === "number") {
      o.rating = Math.max(1, Math.min(5, Math.round(body.rating)));
    }
    return o;
  });

  if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ outfit: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { id } = await params;
  await mutateDb((db) => {
    db.outfits = db.outfits.filter((o) => !(o.id === id && o.userId === user.id));
  });
  return NextResponse.json({ ok: true });
}
