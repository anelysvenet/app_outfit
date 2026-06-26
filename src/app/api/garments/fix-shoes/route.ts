import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { parseDataUrl, readUpload, saveImage } from "@/lib/storage";
import { orientShoeImage } from "@/lib/shoes";

export const maxDuration = 300;

/**
 * Re-orients already-saved shoes of the current user to the mandatory layout
 * (side profile, horizontal, toe right, centered, transparent PNG). With an
 * optional `{ id }` body, only that single shoe is corrected; otherwise every
 * shoe is processed. Returns the updated garment(s).
 */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { id?: string };

    const db = await readDb();
    const shoes = db.garments.filter(
      (g) =>
        g.userId === user.id &&
        !g.deleted &&
        g.category === "chaussures" &&
        (!body.id || g.id === body.id),
    );
    if (!shoes.length) return NextResponse.json({ fixed: 0, total: 0, garments: [] });

    let fixed = 0;
    const updates: Record<string, { photo: string; cutout?: string }> = {};

    for (const g of shoes) {
      const src = await readUpload(g.cutout ?? g.photo);
      if (!src) continue;
      const oriented = await orientShoeImage(src.base64, src.mediaType);
      if (!oriented) continue;

      const p = parseDataUrl(oriented.photoDataUrl);
      const c = parseDataUrl(oriented.cutoutDataUrl);
      const [photoUrl, cutoutUrl] = await Promise.all([
        saveImage(p.base64, p.mediaType),
        saveImage(c.base64, c.mediaType),
      ]);
      updates[g.id] = { photo: photoUrl, cutout: cutoutUrl };
      fixed++;
    }

    let updatedGarments: typeof db.garments = [];
    if (fixed) {
      await mutateDb((d) => {
        for (const item of d.garments) {
          const u = updates[item.id];
          if (u) {
            item.photo = u.photo;
            item.cutout = u.cutout;
          }
        }
        updatedGarments = d.garments.filter((item) => updates[item.id]);
      });
    }

    return NextResponse.json({
      fixed,
      total: shoes.length,
      garments: updatedGarments,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Correction impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
