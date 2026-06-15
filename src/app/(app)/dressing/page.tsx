"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/Modal";
import GarmentForm from "@/components/GarmentForm";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
  type Garment,
} from "@/lib/types";

export default function DressingPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "tous">("tous");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Garment | null>(null);

  useEffect(() => {
    fetch("/api/garments")
      .then((r) => r.json())
      .then((d) => setGarments(d.garments ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      filter === "tous" ? garments : garments.filter((g) => g.category === filter),
    [garments, filter],
  );

  async function remove(id: string) {
    setGarments((prev) => prev.filter((g) => g.id !== id));
    await fetch(`/api/garments/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Ma garde-robe</p>
          <h1 className="font-display mt-1 text-4xl">
            Dressing
            <span className="ml-3 align-middle text-base text-smoke font-body">
              {garments.length} pièce{garments.length > 1 ? "s" : ""}
            </span>
          </h1>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Ajouter un vêtement
        </button>
      </div>

      <div className="mt-8">
        <label className="relative inline-flex w-full max-w-xs items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Category | "tous")}
            className="w-full cursor-pointer appearance-none rounded-full border border-ink/15 bg-white px-5 py-2.5 pr-11 text-sm font-medium text-ink transition hover:border-gold focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="tous">Toutes les catégories ({garments.length})</option>
            {CATEGORIES.map((c) => {
              const count = garments.filter((g) => g.category === c).length;
              return (
                <option key={c} value={c} disabled={count === 0}>
                  {CATEGORY_LABELS[c]} ({count})
                </option>
              );
            })}
          </select>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute right-4 h-4 w-4 text-smoke"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </label>
      </div>

      {loading ? (
        <p className="mt-16 text-center text-smoke">Chargement du dressing…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-16 rounded-3xl bg-sand/50 p-12 text-center">
          <p className="font-display text-2xl">Votre dressing est vide.</p>
          <p className="mt-2 text-smoke">
            Photographiez vos vêtements — l&apos;IA identifie automatiquement
            type, coupe, couleurs et matière.
          </p>
          <button className="btn-primary mt-6" onClick={() => setAdding(true)}>
            Ajouter ma première pièce
          </button>
        </div>
      ) : (
        <motion.div layout className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence>
            {filtered.map((g) => (
              <motion.div
                key={g.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                whileHover={{ y: -6 }}
                className="group cursor-pointer overflow-hidden rounded-2xl bg-white shadow-card"
                onClick={() => setEditing(g)}
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-sand">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.photo}
                    alt={g.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  {g.evening && (
                    <span className="absolute left-3 top-3 rounded-full bg-night/85 px-3 py-1 text-xs italic font-display text-champagne">
                      Soirée
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(g.id);
                    }}
                    className="absolute right-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-xs text-smoke opacity-0 transition group-hover:opacity-100 hover:text-terracotta cursor-pointer"
                    aria-label="Supprimer"
                  >
                    ✕
                  </button>
                </div>
                <div className="p-4">
                  <p className="text-xs uppercase tracking-[0.15em] text-gold">
                    {CATEGORY_LABELS[g.category]}
                    {g.cut ? ` · ${g.cut}` : ""}
                  </p>
                  <p className="mt-1 font-medium leading-snug">{g.name}</p>
                  <p className="mt-1 text-xs text-smoke">
                    {[g.colors.join(", "), g.material].filter(Boolean).join(" — ")}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Nouvelle pièce" wide>
        <GarmentForm
          onSaved={(g) => {
            setGarments((prev) => [g, ...prev]);
            setAdding(false);
          }}
        />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Modifier la pièce"
        wide
      >
        {editing && (
          <GarmentForm
            existing={editing}
            onSaved={(g) => {
              setGarments((prev) => prev.map((x) => (x.id === g.id ? g : x)));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
