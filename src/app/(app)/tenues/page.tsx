"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OutfitCard from "@/components/OutfitCard";
import type { Garment, Outfit } from "@/lib/types";

export default function OutfitsPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Historique</p>
      <h1 className="font-display mt-1 text-4xl">Mes tenues</h1>
      <p className="mt-2 text-sm text-smoke">
        Toutes les tenues composées par votre styliste IA. Vos notes affinent
        les prochaines recommandations.
      </p>

      {loading ? (
        <p className="mt-16 text-center text-smoke">Chargement…</p>
      ) : outfits.length === 0 ? (
        <div className="mt-16 rounded-3xl bg-sand/50 p-12 text-center">
          <p className="font-display text-2xl">Aucune tenue pour l&apos;instant.</p>
          <Link href="/generer" className="btn-primary mt-6 inline-flex">
            Composer ma première tenue
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {outfits.map((o, i) => (
            <OutfitCard
              key={o.id}
              outfit={o}
              garments={garments}
              userPhoto={photo}
              index={Math.min(i, 3)}
              onDeleted={() =>
                setOutfits((prev) => prev.filter((x) => x.id !== o.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
