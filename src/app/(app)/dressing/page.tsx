"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "@/components/Modal";
import GarmentForm from "@/components/GarmentForm";
import CategorySelect from "@/components/CategorySelect";
import {
  CATEGORIES,
  type Category,
  type Garment,
} from "@/lib/types";
import { DiscoIcon, RotateCwIcon } from "@/components/icons";
import CutoutImage from "@/components/CutoutImage";
import { useT } from "@/contexts/LanguageContext";

function DressingContent() {
  const t = useT();
  const pickMode = useSearchParams().get("pick") === "1";
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

  // Rotate a garment 90° clockwise (image + cut-out) and persist it
  function rotated90(src: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const im = new Image();
      if (!src.startsWith("data:")) im.crossOrigin = "anonymous";
      im.onload = () => {
        const c = document.createElement("canvas");
        c.width = im.naturalHeight;
        c.height = im.naturalWidth;
        const ctx = c.getContext("2d")!;
        ctx.translate(c.width, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(im, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      im.onerror = reject;
      im.src = src;
    });
  }

  async function rotateGarment(g: Garment) {
    try {
      const photoRot = await rotated90(g.photo);
      const cutoutRot = g.cutout ? await rotated90(g.cutout) : undefined;
      // Optimistic update
      setGarments((prev) =>
        prev.map((x) => (x.id === g.id ? { ...x, photo: photoRot, cutout: cutoutRot ?? x.cutout } : x)),
      );
      const res = await fetch(`/api/garments/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: photoRot, ...(cutoutRot ? { cutoutDataUrl: cutoutRot } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.garment) {
        setGarments((prev) => prev.map((x) => (x.id === g.id ? data.garment : x)));
      }
    } catch {
      /* ignore — keep current */
    }
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

      {pickMode && (
        <div className="mt-5 rounded-2xl bg-sand/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{t("home.idea_label")}</p>
          <p className="mt-1 text-sm text-ink">{t("home.idea_sub")}</p>
        </div>
      )}

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
                className="group cursor-pointer rounded-2xl"
                onClick={() => setEditing(g)}
              >
                <div className="relative flex aspect-[3/4] items-center justify-center">
                  <CutoutImage
                    src={g.cutout ?? g.photo}
                    alt={g.name}
                    className="max-h-full max-w-full object-contain transition duration-700 group-hover:scale-105"
                  />
                  {g.evening && (
                    <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-night/85 backdrop-blur-sm">
                      <DiscoIcon className="h-4 w-4 text-champagne" />
                    </span>
                  )}
                  <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateGarment(g);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-smoke shadow-sm transition hover:text-ink cursor-pointer"
                      aria-label={t("form.rotate_right")}
                    >
                      <RotateCwIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(g.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs text-smoke shadow-sm transition hover:text-terracotta cursor-pointer"
                      aria-label="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
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
                  {pickMode && (
                    <Link
                      href={`/generer?base=${g.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-ink py-2 text-xs font-medium text-ivory transition hover:bg-night"
                    >
                      <span className="text-champagne">✦</span>
                      {t("dressing.build_outfit")}
                    </Link>
                  )}
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
            onDeleted={(id) => {
              setGarments((prev) => prev.filter((x) => x.id !== id));
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function DressingPage() {
  return (
    <Suspense fallback={null}>
      <DressingContent />
    </Suspense>
  );
}
