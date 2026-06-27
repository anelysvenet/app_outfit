"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import type { Garment } from "@/lib/types";
import { useT } from "@/contexts/LanguageContext";

const stagger: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.055, duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function SoireePage() {
  const t = useT();
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

  async function deleteGarment(g: Garment) {
    setGarments((prev) => prev.filter((x) => x.id !== g.id));
    await fetch(`/api/garments/${g.id}`, { method: "DELETE" });
  }

  const selected = garments.filter((g) => g.evening);
  const others = garments.filter((g) => !g.evening);

  return (
    <div className="-mx-5 -my-10 min-h-screen bg-night text-ivory">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden px-5 pb-12 pt-10 text-center">
        <div className="pointer-events-none absolute -top-28 left-1/3 h-[28rem] w-[28rem] rounded-full bg-champagne/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -right-12 top-4 h-64 w-64 rounded-full bg-terracotta/[0.05] blur-3xl" />

        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-xs uppercase tracking-[0.35em] text-champagne/70"
        >
          {t("evening.label")}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.07 }}
          className="font-display mt-1 text-5xl italic text-gold"
        >
          {t("evening.title")}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ivory/45"
        >
          {t("evening.subtitle")}
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
            {t("evening.cta")}
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
            {t("evening.loading")}
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
                  <h2 className="font-display text-2xl">{t("evening.selection")}</h2>
                  <span className="text-xs text-champagne">
                    {selected.length} {selected.length > 1 ? t("evening.pieces") : t("evening.piece")}
                  </span>
                </div>

                <div className="mt-5 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex gap-4 px-5" style={{ width: "max-content" }}>
                    {selected.map((g, i) => (
                      <SelectedCard key={g.id} garment={g} index={i} onToggle={toggleEvening} onDelete={deleteGarment} t={t} />
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
              {selected.length === 0 ? t("evening.all_dressing") : t("evening.add_pieces")}
            </h2>
            <p className="mb-6 mt-1 text-xs text-ivory/30 tracking-wide">
              {t("evening.tap")}
            </p>

            {others.length === 0 ? (
              <p className="text-sm italic text-ivory/35">
                {t("evening.all_in")}
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
  garment, index, onToggle, onDelete, t,
}: {
  garment: Garment;
  index: number;
  onToggle: (g: Garment) => void;
  onDelete: (g: Garment) => void;
  t: (key: string) => string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const menuRef = cardRef; // close on click outside the card

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <motion.div
      ref={cardRef}
      custom={index}
      variants={stagger}
      initial="hidden"
      animate="visible"
      layout
      whileHover={{ y: -5 }}
      className="group relative w-44 shrink-0 overflow-hidden rounded-2xl ring-1 ring-champagne/50 shadow-[0_0_28px_rgba(216,195,154,0.18)]"
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
          {t(`cat.${garment.category}`)}
        </p>
        <p className="text-sm leading-tight text-ivory">{garment.name}</p>
      </div>

      {/* ✕ button */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-night/70 text-xs text-ivory/80 backdrop-blur-sm transition hover:bg-night hover:text-ivory cursor-pointer"
        aria-label="Options"
      >
        ✕
      </button>

      {/* Centered overlay menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-20 flex items-center justify-center p-3"
            style={{ background: "rgba(196,168,136,0.18)", backdropFilter: "blur(2px)" }}
          >
            <div className="w-full overflow-hidden rounded-2xl" style={{
              background: "#f5ede4",
              border: "2px solid #DDB8A8",
              boxShadow: "0 0 8px #DDB8A8, 0 0 22px rgba(221,184,168,0.8), 0 0 50px rgba(221,184,168,0.4)"
            }}>
              <button
                onClick={() => { onToggle(garment); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm text-ink/80 transition hover:bg-black/8 cursor-pointer"
              >
                <span className="text-[10px] text-ink/40">✦</span>
                {t("evening.remove")}
              </button>
              <div className="h-px bg-ink/10" />
              <button
                onClick={() => { onDelete(garment); setMenuOpen(false); }}
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-sm font-medium text-terracotta transition hover:bg-terracotta/10 cursor-pointer"
              >
                <span className="text-xs">✕</span>
                {t("evening.delete")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function GarmentTile({
  garment, index, onToggle,
}: {
  garment: Garment; index: number; onToggle: (g: Garment) => void;
}) {
  const t = useT();
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
          {t(`cat.${garment.category}`)}
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
