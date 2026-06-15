"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SparklesIcon, DiscoIcon, HangerIcon } from "@/components/icons";
import type { Garment, Outfit } from "@/lib/types";

interface Me {
  name: string;
  photo?: string;
}

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user));
    fetch("/api/garments")
      .then((r) => r.json())
      .then((d) => setGarments(d.garments ?? []));
    fetch("/api/outfits")
      .then((r) => r.json())
      .then((d) => setOutfits(d.outfits ?? []));
  }, []);

  const firstName = me?.name?.split(" ")[0] ?? "";
  const rated = outfits.filter((o) => typeof o.rating === "number").length;

  const stats = [
    { label: "Pièces", value: garments.length, href: "/dressing" },
    { label: "Tenues", value: outfits.length, href: "/tenues" },
    { label: "Notées", value: rated, href: "/tenues" },
  ];

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 22 } },
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {/* Salutation */}
      <motion.div variants={item}>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Bienvenue</p>
        <h1 className="font-display mt-1 text-4xl">
          Bonjour{firstName ? <>, <em className="text-gold">{firstName}</em></> : ""}.
        </h1>
        <p className="mt-2 text-sm text-smoke">
          Que portez-vous aujourd&apos;hui ? Laissez votre styliste composer.
        </p>
      </motion.div>

      {/* Statistiques */}
      <motion.div variants={item} className="mt-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl bg-white p-4 text-center shadow-card transition hover:shadow-lift"
          >
            <p className="font-display text-3xl">{s.value}</p>
            <p className="mt-1 text-xs text-smoke">{s.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* Actions principales */}
      <motion.div variants={item} className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/generer"
          className="group relative overflow-hidden rounded-3xl bg-ink p-6 text-ivory shadow-card transition hover:shadow-lift"
        >
          <SparklesIcon className="h-7 w-7 text-champagne" />
          <p className="font-display mt-4 text-2xl">Créer une tenue</p>
          <p className="mt-1 text-sm text-ivory/70">
            L&apos;IA compose selon la météo et l&apos;occasion.
          </p>
          <span className="mt-4 inline-block text-sm text-champagne">
            Composer →
          </span>
        </Link>

        <Link
          href="/soiree"
          className="group relative overflow-hidden rounded-3xl bg-night p-6 text-ivory shadow-card transition hover:shadow-lift"
        >
          <DiscoIcon className="h-7 w-7 text-champagne" />
          <p className="font-display mt-4 text-2xl italic text-champagne">
            Mode soirée
          </p>
          <p className="mt-1 text-sm text-ivory/70">
            Vos pièces les plus élégantes pour la nuit.
          </p>
          <span className="mt-4 inline-block text-sm text-champagne">
            Préparer ma soirée →
          </span>
        </Link>
      </motion.div>

      {/* Dernières tenues */}
      <motion.div variants={item} className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Dernières tenues</h2>
          {outfits.length > 0 && (
            <Link href="/tenues" className="text-sm text-gold underline-offset-4 hover:underline">
              Tout voir
            </Link>
          )}
        </div>

        {outfits.length === 0 ? (
          <div className="mt-3 rounded-2xl bg-sand/50 p-8 text-center">
            <HangerIcon className="mx-auto h-8 w-8 text-smoke" />
            <p className="mt-3 text-sm text-smoke">
              Aucune tenue pour l&apos;instant. Commencez par composer la première.
            </p>
            <Link href="/generer" className="btn-primary mt-4 inline-flex">
              Composer ma première tenue
            </Link>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {outfits.slice(0, 6).map((o) => {
              const cover = o.items
                .map((it) => garments.find((g) => g.id === it.garmentId)?.photo)
                .find(Boolean);
              return (
                <Link
                  key={o.id}
                  href="/tenues"
                  className={`overflow-hidden rounded-2xl shadow-card transition hover:shadow-lift ${
                    o.evening ? "bg-night" : "bg-white"
                  }`}
                >
                  <div className="aspect-[3/4] bg-sand">
                    {cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.tryOnImage || cover}
                        alt={o.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p
                    className={`truncate px-3 py-2 text-xs ${
                      o.evening ? "text-champagne" : "text-ink"
                    }`}
                  >
                    {o.title}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
