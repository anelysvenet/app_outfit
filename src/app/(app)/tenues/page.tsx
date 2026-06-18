"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import OutfitCard from "@/components/OutfitCard";
import { useT } from "@/contexts/LanguageContext";
import type { Garment, Outfit } from "@/lib/types";

export default function OutfitsPage() {
  const t = useT();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/outfits").then((r) => r.json()),
      fetch("/api/auth/me").then((r) => r.json()),
    ])
      .then(([o, m]) => {
        setOutfits(o.outfits ?? []);
        setGarments(o.garments ?? []);
        setPhoto(m.user?.photo ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterSelect() {
    setSelectMode(true);
    setMenuOpen(true);
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setMenuOpen(false);
  }

  function selectAll() {
    setSelected(new Set(outfits.map((o) => o.id)));
    setMenuOpen(false);
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setOutfits((prev) => prev.filter((o) => !selected.has(o.id)));
    exitSelect();
    // Single request → avoids the race where parallel deletes overwrite each other
    await fetch("/api/outfits", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("outfits.label")}</p>
          <h1 className="font-display mt-1 text-4xl">{t("outfits.title")}</h1>
          <p className="mt-2 text-sm text-smoke">{t("outfits.subtitle")}</p>
        </div>

        {!loading && outfits.length > 0 && (
          <div className="relative mt-1 flex items-center gap-2">
            {selectMode ? (
              <>
                {/* Sélectionner (with dropdown) */}
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-sm transition hover:border-gold cursor-pointer"
                  >
                    {t("outfits.select")}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-smoke">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.97 }}
                          transition={{ duration: 0.16 }}
                          className="absolute right-0 top-[calc(100%+0.4rem)] z-30 w-48 overflow-hidden rounded-2xl border border-ink/5 bg-white p-1.5 shadow-lift"
                        >
                          <button
                            onClick={selectAll}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-ink transition hover:bg-sand cursor-pointer"
                          >
                            <span className="text-gold">✦</span>
                            {t("outfits.select_all")}
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={deleteSelected}
                  disabled={selected.size === 0}
                  className="rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-ivory transition hover:opacity-90 disabled:opacity-40 cursor-pointer"
                >
                  {t("outfits.delete_sel")} ({selected.size})
                </button>
                <button
                  onClick={exitSelect}
                  className="rounded-full px-3 py-2 text-sm text-smoke transition hover:text-ink cursor-pointer"
                >
                  {t("outfits.cancel")}
                </button>
              </>
            ) : (
              <button
                onClick={enterSelect}
                className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm transition hover:border-gold cursor-pointer"
              >
                {t("outfits.select")}
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <p className="mt-16 text-center text-smoke">{t("outfits.loading")}</p>
      ) : outfits.length === 0 ? (
        <div className="mt-16 rounded-3xl bg-sand/50 p-12 text-center">
          <p className="font-display text-2xl">{t("outfits.empty_title")}</p>
          <Link href="/generer" className="btn-primary mt-6 inline-flex">
            {t("outfits.create")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {outfits.map((o, i) => {
            const isSelected = selected.has(o.id);
            return (
              <div key={o.id} className="relative">
                <OutfitCard
                  outfit={o}
                  garments={garments}
                  userPhoto={photo}
                  index={Math.min(i, 3)}
                  onDeleted={() =>
                    setOutfits((prev) => prev.filter((x) => x.id !== o.id))
                  }
                />
                {/* Selection overlay — intercepts taps and shows a checkbox top-left */}
                {selectMode && (
                  <button
                    onClick={() => toggle(o.id)}
                    aria-pressed={isSelected}
                    className={`absolute inset-0 z-30 rounded-3xl transition cursor-pointer ${
                      isSelected ? "ring-2 ring-gold bg-gold/5" : "ring-1 ring-transparent hover:bg-ink/5"
                    }`}
                  >
                    <span
                      className={`absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow transition ${
                        isSelected
                          ? "border-gold bg-gold text-ivory"
                          : "border-white bg-white/80 text-transparent"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
