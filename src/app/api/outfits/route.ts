import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const db = await readDb();
    const outfits = db.outfits
      .filter((o) => o.userId === user.id && !o.deleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const garments = db.garments.filter((g) => g.userId === user.id && !g.deleted);
    return NextResponse.json({ outfits, garments });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Bulk soft-delete (or permanent with ?permanent=1). Done in a SINGLE
 * read-modify-write so parallel deletes can't clobber each other.
 */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Aucune tenue sélectionnée" }, { status: 400 });
    }
    const permanent = new URL(req.url).searchParams.get("permanent") === "1";
    const idSet = new Set(ids);

    await mutateDb((db) => {
      if (permanent) {
        db.outfits = db.outfits.filter(
          (o) => !(o.userId === user.id && idSet.has(o.id)),
        );
      } else {
        const now = new Date().toISOString();
        for (const o of db.outfits) {
          if (o.userId === user.id && idSet.has(o.id)) {
            o.deleted = true;
            o.deletedAt = now;
          }
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
