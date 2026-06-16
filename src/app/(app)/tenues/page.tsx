"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import OutfitCard from "@/components/OutfitCard";
import { useT } from "@/contexts/LanguageContext";
import type { Garment, Outfit } from "@/lib/types";

export default function OutfitsPage() {
  const t = useT();
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
      <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("outfits.label")}</p>
      <h1 className="font-display mt-1 text-4xl">{t("outfits.title")}</h1>
      <p className="mt-2 text-sm text-smoke">
        {t("outfits.subtitle")}
      </p>

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
