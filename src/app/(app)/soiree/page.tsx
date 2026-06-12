"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Garment } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";

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
    setGarments((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, evening } : x)),
    );
    await fetch(`/api/garments/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evening }),
    });
  }

  const selected = garments.filter((g) => g.evening);
  const others = garments.filter((g) => !g.evening);

  return (
    <div className="-mx-5 -my-10 min-h-screen bg-night px-5 py-10 text-ivory">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.3em] text-champagne">
          Collection nocturne
        </p>
        <h1 className="font-display mt-1 text-4xl italic">Soirée</h1>
        <p className="mt-2 max-w-xl text-sm text-ivory/60 leading-relaxed">
          Classez ici les pièces réservées aux événements et sorties nocturnes.
          En mode Soirée, l&apos;IA compose vos tenues en priorité à partir de
          cette sélection.
        </p>

        <div className="mt-6">
          <Link
            href="/generer?soiree=1"
            className="inline-flex items-center gap-2 rounded-full bg-champagne px-6 py-3 text-sm font-medium text-night transition hover:shadow-lift"
          >
            ✦ Composer une tenue de soirée
          </Link>
        </div>

        {loading ? (
          <p className="mt-16 text-center text-ivory/50">Chargement…</p>
        ) : (
          <>
            <h2 className="font-display mt-12 text-2xl">
              Ma sélection{" "}
              <span className="text-base text-ivory/40 font-body">
                {selected.length} pièce{selected.length > 1 ? "s" : ""}
              </span>
            </h2>
            {selected.length === 0 ? (
              <p className="mt-4 text-sm text-ivory/50 italic">
                Aucune pièce classée en soirée — touchez une pièce ci-dessous
                pour l&apos;ajouter.
              </p>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {selected.map((g) => (
                  <GarmentTile key={g.id} garment={g} onToggle={toggleEvening} inSelection />
                ))}
              </div>
            )}

            <h2 className="font-display mt-14 text-2xl text-ivory/80">
              Le reste du dressing
            </h2>
            <p className="mt-1 text-xs text-ivory/40">
              Touchez une pièce pour la classer en soirée.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {others.map((g) => (
                <GarmentTile key={g.id} garment={g} onToggle={toggleEvening} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GarmentTile({
  garment,
  onToggle,
  inSelection,
}: {
  garment: Garment;
  onToggle: (g: Garment) => void;
  inSelection?: boolean;
}) {
  return (
    <motion.button
      layout
      whileHover={{ y: -4 }}
      onClick={() => onToggle(garment)}
      className={`group relative overflow-hidden rounded-2xl text-left transition cursor-pointer ${
        inSelection
          ? "ring-2 ring-champagne shadow-[0_0_32px_rgba(216,195,154,0.25)]"
          : "opacity-75 hover:opacity-100"
      }`}
    >
      <div className="aspect-[3/4] bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={garment.photo}
          alt={garment.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night/95 to-transparent p-3 pt-8">
        <p className="text-xs uppercase tracking-wider text-champagne/80">
          {CATEGORY_LABELS[garment.category]}
        </p>
        <p className="text-sm">{garment.name}</p>
      </div>
      <span
        className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
          inSelection
            ? "bg-champagne text-night"
            : "bg-ivory/15 text-ivory opacity-0 group-hover:opacity-100"
        }`}
      >
        {inSelection ? "✓" : "+"}
      </span>
    </motion.button>
  );
}
