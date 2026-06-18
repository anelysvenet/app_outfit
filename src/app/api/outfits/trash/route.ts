import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const db = await readDb();
    const garmentPhoto = (id: string) => db.garments.find((g) => g.id === id)?.photo;
    const outfits = db.outfits
      .filter((o) => o.userId === user.id && o.deleted)
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""))
      .map((o) => ({
        id: o.id,
        title: o.title,
        cover: o.items.map((it) => garmentPhoto(it.garmentId)).find(Boolean) ?? null,
      }));
    return NextResponse.json({ outfits });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
