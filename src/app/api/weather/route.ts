import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchWeather, reverseCity, searchCity } from "@/lib/weather";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

    const url = new URL(req.url);
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    const city = url.searchParams.get("city");
    const search = url.searchParams.get("search");

    if (search) {
      const results = await searchCity(search);
      return NextResponse.json({ results });
    }

    if (lat && lon) {
      const label = await reverseCity(Number(lat), Number(lon));
      const weather = await fetchWeather(Number(lat), Number(lon), label);
      return NextResponse.json({ weather });
    }

    if (city) {
      const results = await searchCity(city);
      if (!results.length) {
        return NextResponse.json({ error: "Ville introuvable" }, { status: 404 });
      }
      const c = results[0];
      const weather = await fetchWeather(c.latitude, c.longitude, c.name);
      return NextResponse.json({ weather });
    }

    return NextResponse.json(
      { error: "Paramètres requis : lat/lon, city ou search" },
      { status: 400 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Météo indisponible";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
