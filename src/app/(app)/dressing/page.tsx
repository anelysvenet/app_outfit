"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/Modal";
import GarmentForm from "@/components/GarmentForm";
import CategorySelect from "@/components/CategorySelect";
import {
  CATEGORIES,
  type Category,
  type Garment,
} from "@/lib/types";
import { DiscoIcon } from "@/components/icons";
import { useT } from "@/contexts/LanguageContext";

export default function DressingPage() {
  const t = useT();
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
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("dressing.label")}</p>
          <h1 className="font-display mt-1 text-4xl">
            {t("dressing.title")}
            <span className="ml-3 align-middle text-base text-smoke font-body">
              {garments.length} {garments.length > 1 ? t("evening.pieces") : t("evening.piece")}
            </span>
          </h1>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          {t("dressing.add")}
        </button>
      </div>

      <div className="mt-8">
        <CategorySelect
          value={filter}
          onChange={(v) => setFilter(v as Category | "tous")}
          options={[
            { value: "tous", label: t("dressing.all_categories"), count: garments.length },
            ...CATEGORIES.map((c) => ({
              value: c,
              label: t(`cat.${c}`),
              count: garments.filter((g) => g.category === c).length,
            })),
          ]}
        />
      </div>

      {loading ? (
        <p className="mt-16 text-center text-smoke">{t("dressing.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="mt-16 rounded-3xl bg-sand/50 p-12 text-center">
          <p className="font-display text-2xl">{t("dressing.empty_title")}</p>
          <p className="mt-2 text-smoke">
            {t("dressing.empty_sub")}
          </p>
          <button className="btn-primary mt-6" onClick={() => setAdding(true)}>
            {t("dressing.add_first")}
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
                    <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-night/85 backdrop-blur-sm">
                      <DiscoIcon className="h-4 w-4 text-champagne" />
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
                    {t(`cat.${g.category}`)}
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
