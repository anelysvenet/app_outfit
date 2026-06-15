import { NextResponse } from "next/server";
import { getCurrentUser, sanitizeUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { parseDataUrl, saveImage } from "@/lib/storage";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      styles?: string[];
      cities?: string[];
      photoDataUrl?: string;
      language?: string;
      country?: string;
      currency?: string;
      promoCode?: string;
    };

    let photo: string | undefined;
    if (body.photoDataUrl) {
      const { base64, mediaType } = parseDataUrl(body.photoDataUrl);
      photo = await saveImage(base64, mediaType);
    }

    const updated = await mutateDb((db) => {
      const u = db.users.find((x) => x.id === user.id);
      if (!u) return null;
      if (Array.isArray(body.styles)) u.styles = body.styles.slice(0, 10);
      if (Array.isArray(body.cities)) u.cities = body.cities.slice(0, 10);
      if (photo) u.photo = photo;
      if (body.language) u.language = body.language;
      if (body.country) u.country = body.country;
      if (body.currency) u.currency = body.currency;
      if (body.promoCode !== undefined) u.promoCode = body.promoCode;
      return u;
    });

    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ user: sanitizeUser(updated) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
