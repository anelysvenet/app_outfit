"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Stars from "./Stars";
import LogoLoader from "./LogoLoader";
import { SwapIcon } from "./icons";
import { useT } from "@/contexts/LanguageContext";
import type { Category, Garment, Outfit } from "@/lib/types";
import CutoutImage from "./CutoutImage";

export default function OutfitCard({
  outfit,
  garments,
  userPhoto,
  onRated,
  onDeleted,
  onSwap,
  wardrobe,
  index = 0,
}: {
  outfit: Outfit;
  garments: Garment[];
  userPhoto?: string | null;
  onRated?: (rating: number) => void;
  onDeleted?: () => void;
  onSwap?: (oldGarmentId: string, next: Garment) => void;
  wardrobe?: Garment[];
  index?: number;
}) {
  const t = useT();
  const [rating, setRating] = useState(outfit.rating);
  const [tryOnImage, setTryOnImage] = useState(outfit.tryOnImage);
  const [tryOnLoading, setTryOnLoading] = useState(false);
  const [tryOnMessage, setTryOnMessage] = useState<string | null>(null);
  const [showLookbook, setShowLookbook] = useState(false);
  const [picker, setPicker] = useState<{ oldId: string; category: Category } | null>(null);

  const swapEnabled = Boolean(onSwap && wardrobe);

  const itemsKey = outfit.items.map((it) => it.garmentId).join(",");
  // Composition changed (swap) → reset stale virtual try-on
  useEffect(() => {
    setTryOnImage(outfit.tryOnImage);
    setShowLookbook(false);
    setTryOnMessage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTryOnMessage(data.error ?? t("outfit.try_on_impossible"));
      } else if (data.image) {
        setTryOnImage(data.image);
      } else {
        // fal.ai absent ou indisponible → rendu lookbook élégant
        setShowLookbook(true);
        setTryOnMessage(t("outfit.lookbook_fallback"));
      }
    } catch {
      setTryOnMessage(t("outfit.try_on_retry"));
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

        {/* Flat-lay compact — pièces détourées sur le fond de l'application (sans démarcation) */}
        <div className="mt-5 rounded-2xl bg-ivory p-3">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map(({ role, garment }, i) => (
              <motion.button
                key={garment.id + i}
                type="button"
                disabled={!swapEnabled}
                onClick={() =>
                  swapEnabled && setPicker({ oldId: garment.id, category: garment.category })
                }
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 + 0.12 + i * 0.06 }}
                className={`group relative rounded-lg p-1.5 text-left transition ${
                  swapEnabled ? "cursor-pointer hover:bg-black/[0.04]" : "cursor-default"
                }`}
              >
                <div className="flex aspect-square items-center justify-center">
                  <CutoutImage
                    src={garment.cutout ?? garment.photo}
                    alt={garment.name}
                    className="max-h-full max-w-full object-contain transition duration-500 group-hover:scale-105"
                  />
                </div>
                <p className="mt-1 truncate text-[10px] leading-tight text-ink/70">{garment.name}</p>
                {swapEnabled && (
                  <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-night/75 text-ivory opacity-0 shadow transition group-hover:opacity-100">
                    <SwapIcon className="h-3 w-3" />
                  </span>
                )}
              </motion.button>
            ))}
          </div>
          {swapEnabled && (
            <p className="mt-1.5 text-center text-[11px] text-smoke">{t("outfit.tap_to_swap")}</p>
          )}
        </div>

        <p className={`mt-4 text-sm leading-relaxed ${outfit.evening ? "text-ivory/80" : "text-ink/80"}`}>
          {outfit.explanation}
        </p>
        <p className={`mt-3 text-sm italic ${outfit.evening ? "text-champagne" : "text-gold"}`}>
          {outfit.tips}
        </p>

        {/* Essayage virtuel — animation du logo pendant le calcul */}
        {tryOnLoading && (
          <div className="mt-6 rounded-2xl bg-sand/40 p-4">
            <LogoLoader label={t("outfit.generating")} />
          </div>
        )}

        {/* Essayage virtuel */}
        {!tryOnLoading && (tryOnImage || showLookbook) && (
          <div className="mt-6 rounded-2xl bg-sand/40 p-4">
            <p className={`mb-3 text-xs uppercase tracking-[0.2em] ${outfit.evening ? "text-champagne" : "text-gold"}`}>
              {t("outfit.virtual_try_on_label")}
            </p>
            {tryOnImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tryOnImage}
                alt={t("outfit.virtual_try_on_label")}
                className="mx-auto max-h-[480px] rounded-xl object-contain"
              />
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-4">
                {userPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userPhoto}
                    alt=""
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
        <div className="mt-6 space-y-4 border-t border-current/10 pt-5">
          {/* Essayage virtuel — toujours visible */}
          <button
            onClick={tryOn}
            disabled={tryOnLoading}
            className={`w-full rounded-full py-3 text-sm font-medium tracking-wide transition disabled:opacity-40 cursor-pointer ${
              outfit.evening
                ? "bg-champagne/15 border border-champagne/60 text-champagne hover:bg-champagne/25"
                : "bg-ink text-ivory hover:bg-night"
            }`}
          >
            {tryOnLoading ? t("outfit.generating") : t("outfit.try_on")}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`mb-1 text-xs ${outfit.evening ? "text-ivory/50" : "text-smoke"}`}>
                {t("outfit.rate_label")}
              </p>
              <Stars value={rating} onChange={rate} />
            </div>
            {onDeleted && (
              <button
                onClick={async () => {
                  await fetch(`/api/outfits/${outfit.id}`, { method: "DELETE" });
                  onDeleted();
                }}
                className={`text-sm transition cursor-pointer ${outfit.evening ? "text-ivory/50 hover:text-terracotta" : "text-smoke hover:text-terracotta"}`}
              >
                {t("outfit.delete")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sélecteur de remplacement — choisir un autre vêtement de la même catégorie */}
      <AnimatePresence>
        {picker && wardrobe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPicker(null)}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-night/70 p-4 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80vh] w-full overflow-y-auto rounded-3xl bg-[#f5ede4] p-5 text-ink sm:max-w-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <h4 className="font-display text-xl">
                  {t("outfit.choose")} · {t(`cat.${picker.category}`)}
                </h4>
                <button
                  onClick={() => setPicker(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-smoke transition hover:bg-black/5 cursor-pointer"
                  aria-label={t("form.close")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {(() => {
                const choices = wardrobe.filter(
                  (g) => g.category === picker.category && g.id !== picker.oldId,
                );
                if (choices.length === 0) {
                  return (
                    <p className="py-6 text-center text-sm italic text-smoke">
                      {t("outfit.no_alternative")}
                    </p>
                  );
                }
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {choices.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          onSwap?.(picker.oldId, g);
                          setPicker(null);
                        }}
                        className="group text-left cursor-pointer"
                      >
                        <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={g.photo}
                            alt={g.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                        <p className="mt-1 truncate text-xs text-ink/80">{g.name}</p>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
