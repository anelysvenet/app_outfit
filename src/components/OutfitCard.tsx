"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Stars from "./Stars";
import type { Garment, Outfit } from "@/lib/types";

export default function OutfitCard({
  outfit,
  garments,
  userPhoto,
  onRated,
  onDeleted,
  index = 0,
}: {
  outfit: Outfit;
  garments: Garment[];
  userPhoto?: string | null;
  onRated?: (rating: number) => void;
  onDeleted?: () => void;
  index?: number;
}) {
  const [rating, setRating] = useState(outfit.rating);
  const [tryOnImage, setTryOnImage] = useState(outfit.tryOnImage);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnMessage, setTryOnMessage] = useState<string | null>(null);
  const [showLookbook, setShowLookbook] = useState(false);

  const items = outfit.items
    .map((it) => ({ role: it.role, garment: garments.find((g) => g.id === it.garmentId) }))
    .filter((it): it is { role: string; garment: Garment } => Boolean(it.garment));

  async function rate(n: number) {
    setRating(n);
    await fetch(`/api/outfits/${outfit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: n }),
    });
    onRated?.(n);
  }

  async function tryOn() {
    setTryOnLoading(true);
    setTryOnMessage(null);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId: outfit.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTryOnMessage(data.error ?? "Essayage impossible");
      } else if (data.image) {
        setTryOnImage(data.image);
      } else {
        // Pas de moteur d'essayage configuré → rendu lookbook local
        setShowLookbook(true);
        setTryOnMessage(
          "Essayage réaliste non configuré (clé FAL_KEY absente) — voici votre lookbook.",
        );
      }
    } catch {
      setTryOnMessage("Essayage impossible, réessayez.");
    } finally {
      setTryOnLoading(false);
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12, type: "spring", damping: 24 }}
      className={`overflow-hidden rounded-3xl shadow-card ${
        outfit.evening ? "bg-night text-ivory" : "bg-white"
      }`}
    >
      <div className="p-6 sm:p-8">
        <div className="mb-1 flex items-center gap-3 text-xs uppercase tracking-[0.2em]">
          <span className={outfit.evening ? "text-champagne" : "text-gold"}>
            {outfit.occasion}
          </span>
          {outfit.weather && (
            <span className={outfit.evening ? "text-ivory/50" : "text-smoke"}>
              {outfit.weather.city} · {outfit.weather.temperature}°C
            </span>
          )}
        </div>
        <h3 className="font-display text-3xl italic">{outfit.title}</h3>

        {/* Pièces de la tenue */}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {items.map(({ role, garment }, i) => (
            <motion.figure
              key={garment.id + i}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.12 + 0.15 + i * 0.08 }}
              className="w-28 shrink-0 sm:w-36"
            >
              <div className="aspect-[3/4] overflow-hidden rounded-xl bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={garment.photo}
                  alt={garment.name}
                  className="h-full w-full object-cover transition duration-500 hover:scale-105"
                />
              </div>
              <figcaption
                className={`mt-2 text-xs ${outfit.evening ? "text-ivory/60" : "text-smoke"}`}
              >
                <span className="block font-medium capitalize">{role}</span>
                {garment.name}
              </figcaption>
            </motion.figure>
          ))}
        </div>

        <p className={`mt-4 text-sm leading-relaxed ${outfit.evening ? "text-ivory/80" : "text-ink/80"}`}>
          {outfit.explanation}
        </p>
        <p className={`mt-3 text-sm italic ${outfit.evening ? "text-champagne" : "text-gold"}`}>
          Conseil styliste — {outfit.tips}
        </p>

        {/* Essayage virtuel */}
        {(tryOnImage || showLookbook) && (
          <div className="mt-6 rounded-2xl bg-sand/40 p-4">
            <p className={`mb-3 text-xs uppercase tracking-[0.2em] ${outfit.evening ? "text-champagne" : "text-gold"}`}>
              Essayage virtuel
            </p>
            {tryOnImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tryOnImage}
                alt="Essayage virtuel"
                className="mx-auto max-h-[480px] rounded-xl object-contain"
              />
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {userPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userPhoto}
                    alt="Vous"
                    className="h-72 rounded-xl object-cover"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  {items.slice(0, 4).map(({ garment }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={garment.id}
                      src={garment.photo}
                      alt={garment.name}
                      className="h-32 w-24 rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {tryOnMessage && (
          <p className={`mt-3 text-xs ${outfit.evening ? "text-ivory/60" : "text-smoke"}`}>
            {tryOnMessage}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-current/10 pt-5">
          <div>
            <p className={`mb-1 text-xs ${outfit.evening ? "text-ivory/50" : "text-smoke"}`}>
              Notez cette tenue pour affiner vos recommandations
            </p>
            <Stars value={rating} onChange={rate} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={tryOn}
              disabled={tryOnLoading}
              className={outfit.evening ? "btn-ghost border-ivory/30 text-ivory hover:border-champagne hover:text-champagne" : "btn-ghost"}
            >
              {tryOnLoading ? "Génération…" : "Essayage virtuel"}
            </button>
            {onDeleted && (
              <button
                onClick={async () => {
                  await fetch(`/api/outfits/${outfit.id}`, { method: "DELETE" });
                  onDeleted();
                }}
                className={`text-sm transition cursor-pointer ${outfit.evening ? "text-ivory/50 hover:text-terracotta" : "text-smoke hover:text-terracotta"}`}
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}
