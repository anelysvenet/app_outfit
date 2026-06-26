import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { parseDataUrl, readUpload, saveImage } from "@/lib/storage";
import { orientShoeImage } from "@/lib/shoes";

export const maxDuration = 300;

/**
 * Re-orients every already-saved shoe of the current user to the mandatory
 * layout (side profile, horizontal, toe right, centered, transparent PNG).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const db = await readDb();
    const shoes = db.garments.filter(
      (g) => g.userId === user.id && !g.deleted && g.category === "chaussures",
    );
    if (!shoes.length) return NextResponse.json({ fixed: 0, total: 0 });

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

    if (fixed) {
      await mutateDb((d) => {
        for (const item of d.garments) {
          const u = updates[item.id];
          if (u) {
            item.photo = u.photo;
            item.cutout = u.cutout;
          }
        }
      });
    }

    return NextResponse.json({ fixed, total: shoes.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Correction impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
