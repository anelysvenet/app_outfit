import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { mutateDb, readDb } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const { currentPassword, newEmail } = (await req.json()) as {
      currentPassword?: string;
      newEmail?: string;
    };

    if (!currentPassword || !newEmail?.includes("@")) {
      return NextResponse.json({ error: "Email ou mot de passe invalide" }, { status: 400 });
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 403 });
    }

    const db = await readDb();
    const conflict = db.users.find((u) => u.email === newEmail && u.id !== user.id);
    if (conflict) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }

    await mutateDb((d) => {
      const u = d.users.find((x) => x.id === user.id);
      if (u) u.email = newEmail;
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
