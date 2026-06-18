import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { id } = await params;
    await mutateDb((db) => {
      db.styleRefs = db.styleRefs.filter((r) => !(r.id === id && r.userId === user.id));
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
