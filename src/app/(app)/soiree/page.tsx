"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { Garment } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

const stagger: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.055, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function SoireePage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/garments")
      .then((r) => r.json())
      .then((d) => setGarments(d.garments ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function toggleEvening(g: Garment) {
    const evening = !g.evening;
    setGarments((prev) => prev.map((x) => (x.id === g.id ? { ...x, evening } : x)));
    await fetch(`/api/garments/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evening }),
    });
  }

  const selected = garments.filter((g) => g.evening);
  const others = garments.filter((g) => !g.evening);

  return (
    <div className="-mx-5 -my-10 min-h-screen bg-night text-ivory">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-5 pb-12 pt-10">
        <div className="pointer-events-none absolute -top-28 left-1/3 h-[28rem] w-[28rem] rounded-full bg-champagne/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -right-12 top-4 h-64 w-64 rounded-full bg-terracotta/[0.05] blur-3xl" />

        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs uppercase tracking-[0.35em] text-champagne/70"
        >
          Collection nocturne
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.07 }}
          className="font-display mt-1 text-5xl italic"
        >
          Soirée
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-3 max-w-sm text-sm leading-relaxed text-ivory/45"
        >
          Constituez votre garde-robe nocturne. L&apos;IA compose vos tenues
          en priorité à partir de cette sélection.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="mt-8"
        >
          <Link
            href="/generer?soiree=1"
            className="inline-flex items-center gap-2.5 rounded-full bg-champagne px-7 py-3.5 text-sm font-medium text-night shadow-[0_0_28px_rgba(216,195,154,0.4)] transition hover:scale-[1.03] hover:shadow-[0_0_44px_rgba(216,195,154,0.55)] active:scale-[0.98]"
          >
            <span className="text-base leading-none">✦</span>
            Composer une tenue de soirée
          </Link>
        </motion.div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-36">
          <motion.span
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.8 }}
            className="text-xs uppercase tracking-[0.3em] text-champagne/50"
          >
            Chargement…
          </motion.span>
        </div>
      ) : (
        <>
          {/* ── Sélection soirée ── */}
          <AnimatePresence>
            {selected.length > 0 && (
              <motion.section
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-baseline gap-3 px-5">
                  <h2 className="font-display text-2xl">Ma sélection</h2>
                  <span className="text-xs text-champagne">
                    {selected.length} pièce{selected.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex gap-4 px-5" style={{ width: "max-content" }}>
                    {selected.map((g, i) => (
                      <SelectedCard key={g.id} garment={g} index={i} onToggle={toggleEvening} />
                    ))}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* ── Divider ── */}
          <div className="mx-5 my-10 h-px bg-gradient-to-r from-transparent via-ivory/10 to-transparent" />

          {/* ── Reste du dressing ── */}
          <section className="px-5 pb-12">
            <h2 className="font-display text-2xl text-ivory/60">
              {selected.length === 0 ? "Tout le dressing" : "Ajouter des pièces"}
            </h2>
            <p className="mb-6 mt-1 text-xs text-ivory/30 tracking-wide">
              Touchez une pièce pour l&apos;intégrer à votre sélection nocturne
            </p>

            {others.length === 0 ? (
              <p className="text-sm italic text-ivory/35">
                Toutes vos pièces sont déjà dans la sélection soirée.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {others.map((g, i) => (
                  <GarmentTile key={g.id} garment={g} index={i} onToggle={toggleEvening} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SelectedCard({
  garment, index, onToggle,
}: {
  garment: Garment; index: number; onToggle: (g: Garment) => void;
}) {
  return (
    <motion.button
      custom={index}
      variants={stagger}
      initial="hidden"
      animate="visible"
      layout
      whileHover={{ y: -5 }}
      onClick={() => onToggle(garment)}
      className="group relative w-44 shrink-0 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-champagne/50 shadow-[0_0_28px_rgba(216,195,154,0.18)]"
    >
      <div className="aspect-[3/4] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={garment.photo} alt={garment.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night via-night/75 to-transparent p-3 pt-10">
        <p className="text-[9px] uppercase tracking-widest text-champagne/60">
          {CATEGORY_LABELS[garment.category]}
        </p>
        <p className="text-sm leading-tight text-ivory">{garment.name}</p>
      </div>

      {/* Selected badge */}
      <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-champagne text-[10px] text-night">
        ✦
      </div>

      {/* Retirer overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-night/65 opacity-0 transition-opacity duration-250 group-hover:opacity-100">
        <span className="rounded-full border border-terracotta/50 bg-terracotta/20 px-4 py-1.5 text-xs text-ivory">
          Retirer
        </span>
      </div>
    </motion.button>
  );
}

function GarmentTile({
  garment, index, onToggle,
}: {
  garment: Garment; index: number; onToggle: (g: Garment) => void;
}) {
  return (
    <motion.button
      custom={index}
      variants={stagger}
      initial="hidden"
      animate="visible"
      layout
      whileHover={{ y: -3 }}
      onClick={() => onToggle(garment)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl opacity-50 transition-opacity duration-300 hover:opacity-100"
    >
      <div className="aspect-[3/4] bg-ink/60">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={garment.photo} alt={garment.name}
          className="h-full w-full object-cover grayscale transition duration-500 group-hover:grayscale-0"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/90 to-transparent p-3 pt-8">
        <p className="text-[9px] uppercase tracking-widest text-ivory/40">
          {CATEGORY_LABELS[garment.category]}
        </p>
        <p className="text-sm leading-tight text-ivory/75">{garment.name}</p>
      </div>

      {/* Add badge */}
      <div className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-ivory/10 text-ivory/50 text-sm opacity-0 transition duration-200 group-hover:opacity-100 group-hover:bg-champagne/25 group-hover:text-champagne">
        +
      </div>
    </motion.button>
  );
}
