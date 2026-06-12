import { NextResponse } from "next/server";
import { mutateDb, newId, readDb } from "@/lib/db";
import { hashPassword, sanitizeUser, setSessionCookie } from "@/lib/auth";
import { parseDataUrl, saveImage } from "@/lib/storage";
import type { User } from "@/lib/types";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, password, styles, photoDataUrl } = body as {
    name?: string;
    email?: string;
    password?: string;
    styles?: string[];
    photoDataUrl?: string;
  };

  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Nom, email et mot de passe (6 caractères min.) requis." },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  if ((await readDb()).users.some((u) => u.email === normalizedEmail)) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  let photo: string | undefined;
  if (photoDataUrl) {
    const { base64, mediaType } = parseDataUrl(photoDataUrl);
    photo = await saveImage(base64, mediaType);
  }

  const user: User = {
    id: newId(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    name: name.trim(),
    styles: Array.isArray(styles) ? styles.slice(0, 10) : [],
    photo,
    cities: [],
    createdAt: new Date().toISOString(),
  };

  await mutateDb((db) => {
    db.users.push(user);
  });
  await setSessionCookie(user.id);

  return NextResponse.json({ user: sanitizeUser(user) });
}
