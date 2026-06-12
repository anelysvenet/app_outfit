import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";
import { sanitizeUser, setSessionCookie, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = (await req.json()) as {
    email?: string;
    password?: string;
  };

  const user = readDb().users.find(
    (u) => u.email === (email ?? "").trim().toLowerCase(),
  );
  if (!user || !password || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Email ou mot de passe incorrect." },
      { status: 401 },
    );
  }

  await setSessionCookie(user.id);
  return NextResponse.json({ user: sanitizeUser(user) });
}
