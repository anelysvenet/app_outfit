"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import OutfitSwiper from "@/components/OutfitSwiper";
import LogoLoader from "@/components/LogoLoader";
import { useT } from "@/contexts/LanguageContext";
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
  const t = useT();
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
        <div>{t("gen.weather_feels")} <span className="block text-base text-current font-medium">{weather.feelsLike}°C</span></div>
        <div>{t("gen.weather_wind")} <span className="block text-base font-medium">{weather.windSpeed} km/h</span></div>
        <div>{t("gen.weather_rain")} <span className="block text-base font-medium">{weather.rainProbability}%</span></div>
        <div>{t("gen.weather_minmax")} <span className="block text-base font-medium">{weather.tempMin}° / {weather.tempMax}°</span></div>
      </div>
    </motion.div>
  );
}

function GeneratorContent() {
  const t = useT();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [occasion, setOccasion] = useState<string>("Travail");
  const [evening, setEvening] = useState(searchParams.get("soiree") === "1");
  const baseId = searchParams.get("base");
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
      if (!res.ok) throw new Error(data.error ?? t("gen.weather_error"));
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
      setError(e instanceof Error ? e.message : t("gen.weather_error"));
    } finally {
      setWeatherLoading(false);
    }
  }

  function loadWeatherByGeolocation() {
    if (!navigator.geolocation) {
      setError(t("gen.geo_unsupported"));
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
          if (!res.ok) throw new Error(data.error ?? t("gen.weather_error"));
          setWeather(data.weather);
        } catch (e) {
          setError(e instanceof Error ? e.message : t("gen.weather_error"));
        } finally {
          setWeatherLoading(false);
        }
      },
      () => {
        setWeatherLoading(false);
        setError(t("gen.geo_denied"));
      },
      { timeout: 10000, enableHighAccuracy: false },
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
        body: JSON.stringify({ occasion, evening, weather, baseGarmentId: baseId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("gen.generate_error"));
      setResults(data.outfits);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("gen.generate_error"));
    } finally {
      setGenerating(false);
    }
  }

  function swapItem(outfitId: string, oldGarmentId: string, next: Garment) {
    setResults((prev) =>
      prev.map((o) => {
        if (o.id !== outfitId) return o;
        const items = o.items.map((it) =>
          it.garmentId === oldGarmentId ? { garmentId: next.id, role: it.role } : it,
        );
        fetch(`/api/outfits/${o.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        return { ...o, items, tryOnImage: undefined };
      }),
    );
  }

  const baseGarment = baseId ? garments.find((g) => g.id === baseId) : undefined;

  const wardrobeReady =
    garments.some((g) => g.category === "chaussures") &&
    (garments.some((g) => g.category === "robe" || g.category === "combinaison") ||
      (garments.some((g) => g.category === "haut" || g.category === "veste") &&
        garments.some((g) => g.category === "bas")));

  return (
    <div className={evening ? "min-h-full" : ""}>
      <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("gen.label")}</p>
      <h1 className="font-display mt-1 text-4xl">
        {evening ? (
          <>{t("gen.title_evening").split(" ").slice(0, -1).join(" ")} <em className="text-champagne bg-night px-3 rounded-xl">{t("gen.title_evening").split(" ").slice(-1)[0]}</em></>
        ) : (
          t("gen.title")
        )}
      </h1>

      {baseGarment && (
        <div className="mt-5 flex items-center gap-4 rounded-2xl bg-sand/60 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={baseGarment.photo}
            alt={baseGarment.name}
            className="h-20 w-16 shrink-0 rounded-lg object-cover"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">{t("gen.around_label")}</p>
            <p className="mt-0.5 font-medium">{baseGarment.name}</p>
            <p className="text-xs text-smoke">{t("gen.around_sub")}</p>
          </div>
        </div>
      )}

      {!wardrobeReady && garments.length >= 0 && (
        <div className="mt-6 rounded-2xl border border-gold/30 bg-sand/50 p-5 text-sm">
          <p className="font-medium mb-1">{t("gen.incomplete_title")}</p>
          <ul className="list-disc list-inside space-y-0.5 text-smoke">
            {!garments.some((g) => g.category === "chaussures") && (
              <li>{t("gen.incomplete_shoes")}</li>
            )}
            {!garments.some((g) => g.category === "robe") &&
              !garments.some((g) => g.category === "haut" || g.category === "veste") && (
                <li>{t("gen.incomplete_top")}</li>
            )}
            {!garments.some((g) => g.category === "robe") &&
              !garments.some((g) => g.category === "bas") && (
                <li>{t("gen.incomplete_bottom")}</li>
            )}
          </ul>
          <Link href="/dressing" className="mt-3 inline-block text-gold underline underline-offset-4">
            {t("gen.complete_dressing")}
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          {/* 1. Weather */}
          <section>
            <h2 className="font-display text-xl">{t("gen.weather_title")}</h2>
            <p className="mt-1 text-sm text-smoke">
              {t("gen.weather_sub")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="btn-ghost"
                onClick={loadWeatherByGeolocation}
                disabled={weatherLoading}
              >
                {t("gen.geolocate")}
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
                  placeholder={t("gen.city_placeholder")}
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
                <button className="btn-ghost !px-4 !py-2">OK</button>
              </form>
            </div>
            <div className="mt-4">
              {weatherLoading ? (
                <p className="text-sm text-smoke animate-pulse">
                  {t("gen.weather_loading")}
                </p>
              ) : weather ? (
                <WeatherPanel weather={weather} evening={evening} />
              ) : (
                <p className="text-sm text-smoke italic">
                  {t("gen.weather_none")}
                </p>
              )}
            </div>
          </section>

          {/* 2. Occasion */}
          <section>
            <h2 className="font-display text-xl">{t("gen.occasion_title")}</h2>
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
                {t("gen.evening_mode")} <span className="font-display italic text-champagne">{t("gen.evening_mode_label")}</span> —
                {t("gen.evening_mode_sub")}
              </span>
            </label>
          </section>

          {/* 3. Generate */}
          <section>
            <button
              className="btn-primary w-full !py-4 text-base"
              disabled={generating || !wardrobeReady}
              onClick={generate}
            >
              {generating
                ? t("gen.composing")
                : t("gen.compose")}
            </button>
            {generating && <LogoLoader fullscreen label={t("gen.analyzing")} />}
            {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          </section>
        </div>

        {/* Wardrobe preview */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl bg-sand/50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-smoke">
              {t("gen.dressing_preview")} · {garments.length} {t("outfit.pieces")}
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
              {t("gen.results_title")} <em className="text-gold">{t("gen.results_em")}</em>
            </h2>
            <p className="mt-1 text-sm text-smoke">
              {t("gen.results_sub")}
            </p>
            <div className="mt-6">
              <OutfitSwiper
                outfits={results}
                garments={garments}
                userPhoto={me?.photo}
                onSwap={swapItem}
              />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function GeneratorFallback() {
  const t = useT();
  return <p className="text-smoke">{t("gen.loading")}</p>;
}

export default function GeneratorPage() {
  return (
    <Suspense fallback={<GeneratorFallback />}>
      <GeneratorContent />
    </Suspense>
  );
}
