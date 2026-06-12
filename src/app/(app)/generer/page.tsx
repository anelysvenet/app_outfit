"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import OutfitCard from "@/components/OutfitCard";
import {
  OCCASIONS,
  type Garment,
  type Outfit,
  type WeatherSnapshot,
} from "@/lib/types";

interface Me {
  name: string;
  photo?: string;
  cities: string[];
}

function WeatherPanel({
  weather,
  evening,
}: {
  weather: WeatherSnapshot;
  evening: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 ${evening ? "bg-night text-ivory" : "bg-white shadow-card"}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xl">{weather.city}</p>
        <p className="font-display text-3xl">{weather.temperature}°C</p>
      </div>
      <p className={`mt-1 text-sm ${evening ? "text-ivory/70" : "text-smoke"}`}>
        {weather.condition}
      </p>
      <div className={`mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 ${evening ? "text-ivory/70" : "text-smoke"}`}>
        <div>Ressenti <span className="block text-base text-current font-medium">{weather.feelsLike}°C</span></div>
        <div>Vent <span className="block text-base font-medium">{weather.windSpeed} km/h</span></div>
        <div>Pluie <span className="block text-base font-medium">{weather.rainProbability}%</span></div>
        <div>Min / Max <span className="block text-base font-medium">{weather.tempMin}° / {weather.tempMax}°</span></div>
      </div>
    </motion.div>
  );
}

function GeneratorContent() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [occasion, setOccasion] = useState<string>("Travail");
  const [evening, setEvening] = useState(searchParams.get("soiree") === "1");
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Outfit[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
    fetch("/api/garments")
      .then((r) => r.json())
      .then((d) => setGarments(d.garments ?? []));
  }, []);

  useEffect(() => {
    if (evening) setOccasion("Soirée");
  }, [evening]);

  async function loadWeatherByCity(city: string) {
    setWeatherLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Météo indisponible");
      setWeather(data.weather);
      // mémorise la ville dans le profil
      if (me && !me.cities.includes(data.weather.city)) {
        const cities = [...me.cities, data.weather.city].slice(0, 10);
        setMe({ ...me, cities });
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cities }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Météo indisponible");
    } finally {
      setWeatherLoading(false);
    }
  }

  function loadWeatherByGeolocation() {
    if (!navigator.geolocation) {
      setError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    setWeatherLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Météo indisponible");
          setWeather(data.weather);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Météo indisponible");
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setWeatherLoading(false);
        setError("Géolocalisation refusée — ajoutez une ville manuellement.");
      },
      { timeout: 10000 },
    );
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occasion, evening, weather }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Génération impossible");
      setResults(data.outfits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Génération impossible");
    } finally {
      setGenerating(false);
    }
  }

  const wardrobeReady =
    garments.some((g) => g.category === "chaussures") &&
    (garments.some((g) => g.category === "robe") ||
      (garments.some((g) => g.category === "haut") &&
        garments.some((g) => g.category === "bas")));

  return (
    <div className={evening ? "min-h-full" : ""}>
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Styliste IA</p>
      <h1 className="font-display mt-1 text-4xl">
        {evening ? (
          <>Tenue de <em className="text-champagne bg-night px-3 rounded-xl">soirée</em></>
        ) : (
          "Créer une tenue"
        )}
      </h1>

      {!wardrobeReady && garments.length >= 0 && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-sand/50 p-5 text-sm">
          Pour générer une tenue, votre dressing doit contenir au minimum un
          haut et un bas (ou une robe) ainsi qu&apos;une paire de chaussures.{" "}
          <Link href="/dressing" className="text-gold underline underline-offset-4">
            Compléter mon dressing
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* 1. Météo */}
          <section>
            <h2 className="font-display text-xl">1 · La météo du jour</h2>
            <p className="mt-1 text-sm text-smoke">
              Activez la géolocalisation ou choisissez une ville — la tenue
              tiendra compte de la température ressentie, du vent et de la pluie.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost"
                onClick={loadWeatherByGeolocation}
                disabled={weatherLoading}
              >
                ◉ Ma position
              </button>
              {me?.cities.map((c) => (
                <button
                  key={c}
                  className={`chip ${weather?.city === c ? "chip-active" : ""}`}
                  onClick={() => loadWeatherByCity(c)}
                >
                  {c}
                </button>
              ))}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (cityInput.trim()) {
                    loadWeatherByCity(cityInput.trim());
                    setCityInput("");
                  }
                }}
              >
                <input
                  className="field !w-44 !py-2"
                  placeholder="Ajouter une ville…"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
                <button className="btn-ghost !px-4 !py-2">OK</button>
              </form>
            </div>
            <div className="mt-4">
              {weatherLoading ? (
                <p className="text-sm text-smoke animate-pulse">
                  Récupération de la météo…
                </p>
              ) : weather ? (
                <WeatherPanel weather={weather} evening={evening} />
              ) : (
                <p className="text-sm text-smoke italic">
                  Sans météo, l&apos;IA proposera des tenues polyvalentes.
                </p>
              )}
            </div>
          </section>

          {/* 2. Occasion */}
          <section>
            <h2 className="font-display text-xl">2 · L&apos;occasion</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    setOccasion(o);
                    setEvening(o === "Soirée");
                  }}
                  className={`chip ${occasion === o ? "chip-active" : ""}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <label className="mt-4 flex items-center gap-3 rounded-xl bg-night px-4 py-3 text-sm text-ivory cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={evening}
                onChange={(e) => setEvening(e.target.checked)}
                className="h-4 w-4 accent-[#d8c39a]"
              />
              <span>
                Mode <span className="font-display italic text-champagne">Soirée</span> —
                privilégier ma sélection soirée
              </span>
            </label>
          </section>

          {/* 3. Génération */}
          <section>
            <button
              className="btn-primary w-full !py-4 text-base"
              disabled={generating || !wardrobeReady}
              onClick={generate}
            >
              {generating
                ? "L'IA compose vos tenues…"
                : "✦ Composer mes tenues"}
            </button>
            {generating && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-center text-sm text-smoke"
              >
                Analyse de votre garde-robe, de la météo et de vos goûts…
              </motion.p>
            )}
            {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          </section>
        </div>

        {/* Aperçu dressing */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl bg-sand/50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-smoke">
              Votre dressing · {garments.length} pièces
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {garments.slice(0, 12).map((g) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={g.id}
                  src={g.photo}
                  alt={g.name}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Résultats */}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12"
          >
            <h2 className="font-display text-3xl">
              Vos tenues <em className="text-gold">du jour</em>
            </h2>
            <p className="mt-1 text-sm text-smoke">
              Notez chaque proposition : l&apos;IA apprend vos goûts au fil du temps.
            </p>
            <div className="mt-6 space-y-8">
              {results.map((o, i) => (
                <OutfitCard
                  key={o.id}
                  outfit={o}
                  garments={garments}
                  userPhoto={me?.photo}
                  index={i}
                />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GeneratorPage() {
  return (
    <Suspense fallback={<p className="text-smoke">Chargement…</p>}>
      <GeneratorContent />
    </Suspense>
  );
}
