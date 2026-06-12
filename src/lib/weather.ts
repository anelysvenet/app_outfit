import type { WeatherSnapshot } from "./types";

const WMO_LABELS: Record<number, string> = {
  0: "Ciel dégagé",
  1: "Plutôt dégagé",
  2: "Partiellement nuageux",
  3: "Couvert",
  45: "Brouillard",
  48: "Brouillard givrant",
  51: "Bruine légère",
  53: "Bruine",
  55: "Bruine dense",
  61: "Pluie légère",
  63: "Pluie",
  65: "Pluie forte",
  66: "Pluie verglaçante",
  67: "Pluie verglaçante forte",
  71: "Neige légère",
  73: "Neige",
  75: "Neige forte",
  77: "Grésil",
  80: "Averses légères",
  81: "Averses",
  82: "Averses violentes",
  85: "Averses de neige",
  86: "Fortes averses de neige",
  95: "Orage",
  96: "Orage avec grêle",
  99: "Orage violent avec grêle",
};

export interface CityResult {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export async function searchCity(query: string): Promise<CityResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=fr&format=json`;
  const res = await fetch(url, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error("Recherche de ville indisponible");
  const data = await res.json();
  return (data.results ?? []).map(
    (r: { name: string; country?: string; latitude: number; longitude: number }) => ({
      name: r.name,
      country: r.country ?? "",
      latitude: r.latitude,
      longitude: r.longitude,
    }),
  );
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  cityLabel: string,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      "temperature_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "1",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error("Service météo indisponible");
  const data = await res.json();

  return {
    city: cityLabel,
    temperature: Math.round(data.current.temperature_2m),
    feelsLike: Math.round(data.current.apparent_temperature),
    windSpeed: Math.round(data.current.wind_speed_10m),
    precipitation: data.current.precipitation ?? 0,
    rainProbability: data.daily?.precipitation_probability_max?.[0] ?? 0,
    condition: WMO_LABELS[data.current.weather_code] ?? "Conditions inconnues",
    tempMin: Math.round(data.daily?.temperature_2m_min?.[0] ?? data.current.temperature_2m),
    tempMax: Math.round(data.daily?.temperature_2m_max?.[0] ?? data.current.temperature_2m),
  };
}

/** Géocodage inverse approximatif pour étiqueter la position de l'utilisateur. */
export async function reverseCity(latitude: number, longitude: number): Promise<string> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${latitude}&longitude=${longitude}&count=1&language=fr`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]?.name) return data.results[0].name;
    }
  } catch {
    // silencieux — on retombe sur le libellé générique
  }
  return "Ma position";
}
