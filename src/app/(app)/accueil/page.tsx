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

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 24, stiffness: 200 } },
};

export default function HomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
    fetch("/api/garments").then((r) => r.json()).then((d) => setGarments(d.garments ?? []));
    fetch("/api/outfits").then((r) => r.json()).then((d) => setOutfits(d.outfits ?? []));
  }, []);

  const firstName = me?.name?.split(" ")[0] ?? "";
  const rated = outfits.filter((o) => typeof o.rating === "number").length;

  const stats = [
    { label: "Pièces", value: garments.length, href: "/dressing" },
    { label: "Tenues", value: outfits.length, href: "/tenues" },
    { label: "Notées", value: rated, href: "/tenues" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="pb-4">

      {/* ── Greeting ── */}
      <motion.div variants={item}>
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold">Bienvenue</p>
        <h1 className="font-display mt-1 text-5xl leading-tight">
          Bonjour{firstName ? (
            <>, <em className="text-gold">{firstName}</em></>
          ) : ""}.
        </h1>
        <p className="mt-2 text-sm text-smoke">
          Que portez-vous aujourd&apos;hui ?
        </p>
      </motion.div>

      {/* ── Stats strip ── */}
      <motion.div
        variants={item}
        className="mt-8 flex divide-x divide-ink/8 overflow-hidden rounded-2xl border border-ink/6 bg-white/70 shadow-card"
      >
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex-1 py-5 text-center transition hover:bg-sand/40"
          >
            <p className="font-display text-3xl">{s.value}</p>
            <p className="mt-0.5 text-xs text-smoke">{s.label}</p>
          </Link>
        ))}
      </motion.div>

      {/* ── Action cards ── */}
      <motion.div variants={item} className="mt-5 grid gap-3 sm:grid-cols-2">

        {/* Créer une tenue */}
        <Link
          href="/generer"
          className="group relative overflow-hidden rounded-3xl bg-ink p-7 text-ivory shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-champagne/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-black/20 to-transparent" />
          <SparklesIcon className="relative h-6 w-6 text-champagne" />
          <p className="font-display relative mt-5 text-3xl leading-snug">
            Créer<br />une tenue
          </p>
          <p className="relative mt-2 text-sm leading-relaxed text-ivory/55">
            L&apos;IA compose selon la météo et l&apos;occasion.
          </p>
          <div className="relative mt-6 inline-flex items-center gap-1 text-sm text-champagne">
            Composer{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
          </div>
        </Link>

        {/* Mode soirée */}
        <Link
          href="/soiree"
          className="group relative overflow-hidden rounded-3xl bg-night p-7 text-ivory shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -left-8 -top-8 h-36 w-36 rounded-full bg-champagne/8 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-4 -right-4 h-28 w-28 rounded-full bg-terracotta/8 blur-2xl" />
          <DiscoIcon className="relative h-6 w-6 text-champagne" />
          <p className="font-display relative mt-5 text-3xl italic leading-snug text-champagne">
            Mode<br />soirée
          </p>
          <p className="relative mt-2 text-sm leading-relaxed text-ivory/55">
            Vos pièces les plus élégantes pour la nuit.
          </p>
          <div className="relative mt-6 inline-flex items-center gap-1 text-sm text-champagne">
            Préparer{" "}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Dernières tenues ── */}
      <motion.div variants={item} className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">Dernières tenues</h2>
          {outfits.length > 0 && (
            <Link
              href="/tenues"
              className="text-sm text-gold underline-offset-4 hover:underline"
            >
              Tout voir
            </Link>
          )}
        </div>

        {outfits.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-sand/50 p-8 text-center">
            <HangerIcon className="mx-auto h-8 w-8 text-smoke" />
            <p className="mt-3 text-sm text-smoke">
              Aucune tenue pour l&apos;instant. Commencez par composer la première.
            </p>
            <Link href="/generer" className="btn-primary mt-4 inline-flex">
              Composer ma première tenue
            </Link>
          </div>
        ) : (
          <div className="-mx-5 mt-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-5" style={{ width: "max-content" }}>
              {outfits.slice(0, 8).map((o) => {
                const cover = o.items
                  .map((it) => garments.find((g) => g.id === it.garmentId)?.photo)
                  .find(Boolean);
                return (
                  <Link
                    key={o.id}
                    href="/tenues"
                    className={`w-40 shrink-0 overflow-hidden rounded-2xl shadow-card transition hover:shadow-lift hover:-translate-y-1 ${
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
                    <p className={`truncate px-3 py-2.5 text-xs font-medium ${
                      o.evening ? "text-champagne" : "text-ink"
                    }`}>
                      {o.title}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
