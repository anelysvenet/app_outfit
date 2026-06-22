"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import OutfitCard from "@/components/OutfitCard";
import LogoLoader from "@/components/LogoLoader";
import { SuitcaseIcon } from "@/components/icons";
import { useT } from "@/contexts/LanguageContext";
import { OCCASIONS, type Garment, type Outfit, type WeatherSnapshot } from "@/lib/types";

type Packing = { categories: { name: string; items: string[] }[] };

export default function TravelPage() {
  const t = useT();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);

  const [destination, setDestination] = useState("");
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [days, setDays] = useState(3);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [planning, setPlanning] = useState<Record<number, string>>({});
  const [showPlanning, setShowPlanning] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<Outfit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [packing, setPacking] = useState<Packing | null>(null);
  const [packingLoading, setPackingLoading] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/garments").then((r) => r.json()).then((d) => setGarments(d.garments ?? []));
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setPhoto(d.user?.photo ?? null));
  }, []);

  async function loadWeather() {
    if (!destination.trim()) return;
    setWeatherLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(destination.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Météo indisponible");
      setWeather(data.weather);
    } catch (e) {
      setWeather(null);
      setError(e instanceof Error ? e.message : "Météo indisponible");
    } finally {
      setWeatherLoading(false);
    }
  }

  function toggleOccasion(o: string) {
    setOccasions((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]));
  }

  async function generate() {
    if (!destination.trim()) {
      setError(t("travel.need_dest"));
      return;
    }
    setGenerating(true);
    setError(null);
    setResults([]);
    setPacking(null);
    try {
      const planningArr = Object.entries(planning)
        .filter(([, occ]) => occ)
        .map(([day, occasion]) => ({ day: Number(day), occasion }));
      const res = await fetch("/api/travel/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: destination.trim(),
          days,
          occasions,
          planning: showPlanning ? planningArr : undefined,
          weather,
        }),
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

  async function makePacking() {
    setPackingLoading(true);
    try {
      const res = await fetch("/api/travel/packing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), days, occasions, weather }),
      });
      const data = await res.json();
      if (res.ok) setPacking(data.packing);
    } finally {
      setPackingLoading(false);
    }
  }

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ivory">
          <SuitcaseIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("travel.label")}</p>
          <h1 className="font-display text-4xl leading-none">{t("travel.title")}</h1>
        </div>
      </div>
      <p className="mt-3 max-w-lg text-sm text-smoke">{t("travel.sub")}</p>

      <div className="mt-8 space-y-8">
        {/* Destination */}
        <section>
          <h2 className="font-display text-xl">{t("travel.destination")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className="field !w-64"
              placeholder={t("travel.destination_ph")}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onBlur={loadWeather}
              onKeyDown={(e) => e.key === "Enter" && loadWeather()}
            />
            <button className="btn-ghost !px-5" onClick={loadWeather} disabled={weatherLoading}>
              OK
            </button>
          </div>
          {weatherLoading ? (
            <p className="mt-3 text-sm text-smoke animate-pulse">{t("gen.weather_loading")}</p>
          ) : weather ? (
            <div className="mt-3 inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-card">
              <span className="font-display text-lg">{weather.city}</span>
              <span className="font-display text-2xl">{weather.temperature}°</span>
              <span className="text-xs text-smoke">{weather.condition} · {weather.tempMin}°/{weather.tempMax}°</span>
            </div>
          ) : null}
        </section>

        {/* Days */}
        <section>
          <h2 className="font-display text-xl">{t("travel.days")}</h2>
          <div className="mt-3 flex items-center gap-3">
            <button className="btn-ghost !h-10 !w-10 !px-0" onClick={() => setDays((d) => Math.max(1, d - 1))}>−</button>
            <span className="font-display text-2xl w-10 text-center">{days}</span>
            <button className="btn-ghost !h-10 !w-10 !px-0" onClick={() => setDays((d) => Math.min(14, d + 1))}>+</button>
          </div>
        </section>

        {/* Occasions */}
        <section>
          <h2 className="font-display text-xl">{t("travel.occasions")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => toggleOccasion(o)}
                className={`chip ${occasions.includes(o) ? "chip-active" : ""}`}
              >
                {o}
              </button>
            ))}
          </div>
        </section>

        {/* Optional planning */}
        <section>
          <button
            onClick={() => setShowPlanning((s) => !s)}
            className="flex items-center gap-2 text-sm text-gold"
          >
            <span>{showPlanning ? "▾" : "▸"}</span>
            {t("travel.planning")}
          </button>
          {showPlanning && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-smoke">{t("travel.planning_sub")}</p>
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-smoke">{t("travel.day")} {d}</span>
                  <select
                    className="field !py-2 !w-52"
                    value={planning[d] ?? ""}
                    onChange={(e) => setPlanning((p) => ({ ...p, [d]: e.target.value }))}
                  >
                    <option value="">{t("travel.none")}</option>
                    {OCCASIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Generate */}
        <section>
          <button className="btn-primary w-full !py-4 text-base" disabled={generating} onClick={generate}>
            {generating ? t("travel.composing") : t("travel.compose")}
          </button>
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
        </section>
      </div>

      {generating && <LogoLoader fullscreen label={t("travel.composing")} />}

      {/* Results */}
      {results.length > 0 && (
        <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12">
          <h2 className="font-display text-3xl">{t("travel.results")}</h2>
          <div className="mt-6 space-y-8">
            {results.map((o, i) => (
              <div key={o.id}>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-gold">{o.occasion}</p>
                <OutfitCard outfit={o} garments={garments} userPhoto={photo} index={Math.min(i, 3)} />
              </div>
            ))}
          </div>

          {/* Packing list */}
          <div className="mt-10">
            {!packing && !packingLoading && (
              <button className="btn-ghost" onClick={makePacking}>
                ✦ {t("travel.packing_cta")}
              </button>
            )}
            {packingLoading && <LogoLoader label={t("travel.packing_loading")} />}
            {packing && (
              <div className="rounded-3xl bg-sand/50 p-6">
                <h3 className="font-display text-2xl">{t("travel.packing_title")}</h3>
                <div className="mt-5 grid gap-6 sm:grid-cols-2">
                  {packing.categories.map((cat) => (
                    <div key={cat.name}>
                      <p className="text-xs uppercase tracking-[0.2em] text-gold">{cat.name}</p>
                      <ul className="mt-2 space-y-1.5">
                        {cat.items.map((it) => {
                          const key = cat.name + "·" + it;
                          return (
                            <li key={key}>
                              <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checked[key])}
                                  onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                                  className="h-4 w-4 accent-gold"
                                />
                                <span className={checked[key] ? "text-smoke line-through" : "text-ink/80"}>{it}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
