import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser, verifyPassword } from "@/lib/auth";
import { mutateDb } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { password } = (await req.json()) as { password?: string };
    if (!password || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 403 });
    }

    await mutateDb((d) => {
      d.users = d.users.filter((u) => u.id !== user.id);
      d.garments = d.garments.filter((g) => g.userId !== user.id);
      d.outfits = d.outfits.filter((o) => o.userId !== user.id);
    });

    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
