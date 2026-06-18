"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import OutfitCard from "./OutfitCard";
import { useT } from "@/contexts/LanguageContext";
import type { Garment, Outfit } from "@/lib/types";

export default function OutfitSwiper({
  outfits,
  garments,
  userPhoto,
  onSwap,
}: {
  outfits: Outfit[];
  garments: Garment[];
  userPhoto?: string | null;
  onSwap?: (outfitId: string, oldGarmentId: string, next: Garment) => void;
}) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [flinging, setFlinging] = useState(false);
  const n = outfits.length;

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-13, 13]);
  const nextOpacity = useTransform(x, [40, 140], [0, 1]); // drag right → next
  const prevOpacity = useTransform(x, [-140, -40], [1, 0]); // drag left → previous

  const current = outfits[index];
  const peek = outfits[(index + 1) % n];

  // visualDir: direction the card flies off. step: how the index moves.
  function go(visualDir: number, step: number) {
    if (flinging || n < 2) {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      return;
    }
    setFlinging(true);
    animate(x, visualDir * 700, { duration: 0.32, ease: "easeIn" }).then(() => {
      setIndex((i) => (i + step + n) % n);
      x.set(0);
      setFlinging(false);
    });
  }

  function onDragEnd(
    _e: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    const right = info.offset.x > 110 || info.velocity.x > 500;
    const left = info.offset.x < -110 || info.velocity.x < -500;
    if (right) go(1, 1); // swipe right → next proposal
    else if (left) go(-1, -1); // swipe left → previous proposal
    else animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
  }

  return (
    <div>
      <div className="relative mx-auto max-w-2xl">
        {/* Background peek card for depth */}
        {n > 1 && (
          <div
            key={`peek-${index}`}
            className="pointer-events-none absolute inset-0 scale-[0.95] translate-y-3 opacity-50"
            aria-hidden
          >
            <OutfitCard outfit={peek} garments={garments} userPhoto={userPhoto} />
          </div>
        )}

        {/* Top draggable card */}
        <motion.div
          style={{ x, rotate, touchAction: "pan-y" }}
          drag={n > 1 ? "x" : false}
          dragSnapToOrigin
          dragElastic={0.6}
          onDragEnd={onDragEnd}
          className="relative cursor-grab active:cursor-grabbing"
        >
          {/* Swipe hint badges */}
          {n > 1 && (
            <>
              <motion.div
                style={{ opacity: nextOpacity }}
                className="pointer-events-none absolute right-5 top-5 z-20 rounded-full border-2 border-champagne px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-champagne"
              >
                {t("gen.swipe_next")} →
              </motion.div>
              <motion.div
                style={{ opacity: prevOpacity }}
                className="pointer-events-none absolute left-5 top-5 z-20 rounded-full border-2 border-gold px-4 py-1.5 text-sm font-semibold uppercase tracking-widest text-gold"
              >
                ← {t("gen.swipe_prev")}
              </motion.div>
            </>
          )}

          {/* Card content re-mounts on index change for a soft enter animation */}
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            <OutfitCard
              outfit={current}
              garments={garments}
              userPhoto={userPhoto}
              wardrobe={garments}
              onSwap={
                onSwap ? (oldId, next) => onSwap(current.id, oldId, next) : undefined
              }
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Controls */}
      {n > 1 && (
        <div className="mt-6 flex items-center justify-center gap-5">
          <button
            onClick={() => go(-1, -1)}
            disabled={flinging}
            aria-label={t("gen.swipe_prev")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-ink">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {outfits.map((o, i) => (
              <span
                key={o.id}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-gold" : "w-1.5 bg-ink/20"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => go(1, 1)}
            disabled={flinging}
            aria-label={t("gen.swipe_next")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-ink">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-smoke">
        {n > 1
          ? `${index + 1} / ${n} · ${t("gen.swipe_hint")}`
          : `1 / 1`}
      </p>
    </div>
  );
}
