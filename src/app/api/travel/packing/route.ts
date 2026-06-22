import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generatePackingList } from "@/lib/ai";
import type { WeatherSnapshot } from "@/lib/types";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  try {
    const body = (await req.json()) as {
      destination?: string;
      days?: number;
      occasions?: string[];
      weather?: WeatherSnapshot | null;
    };
    const destination = (body.destination || "").trim();
    if (!destination) {
      return NextResponse.json({ error: "Destination requise" }, { status: 400 });
    }

    const packing = await generatePackingList({
      destination,
      days: Math.max(1, Math.min(30, Math.round(body.days || 1))),
      occasions: Array.isArray(body.occasions) ? body.occasions : [],
      weather: body.weather ?? null,
      lang: user.language,
    });

    return NextResponse.json({ packing });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Liste impossible";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
