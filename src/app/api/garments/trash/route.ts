import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readDb } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    const garments = (await readDb())
      .garments.filter((g) => g.userId === user.id && g.deleted)
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));
    return NextResponse.json({ garments });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
