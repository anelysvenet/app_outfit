import { NextResponse } from "next/server";
import { getCurrentUser, sanitizeUser } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { parseDataUrl, saveImage } from "@/lib/storage";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const body = (await req.json()) as {
    styles?: string[];
    cities?: string[];
    photoDataUrl?: string;
  };

  let photo: string | undefined;
  if (body.photoDataUrl) {
    const { base64, mediaType } = parseDataUrl(body.photoDataUrl);
    photo = saveImage(base64, mediaType);
  }

  const updated = mutateDb((db) => {
    const u = db.users.find((x) => x.id === user.id);
    if (!u) return null;
    if (Array.isArray(body.styles)) u.styles = body.styles.slice(0, 10);
    if (Array.isArray(body.cities)) u.cities = body.cities.slice(0, 10);
    if (photo) u.photo = photo;
    return u;
  });

  if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ user: sanitizeUser(updated) });
}
