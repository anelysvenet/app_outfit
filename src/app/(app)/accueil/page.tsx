"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SparklesIcon, HangerIcon, SuitcaseIcon, BagIcon } from "@/components/icons";
import type { Garment, Outfit } from "@/lib/types";
import { useT } from "@/contexts/LanguageContext";

interface Me { name: string; photo?: string }

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09 } } };
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, damping: 26, stiffness: 220 } },
};

export default function HomePage() {
  const t = useT();
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

  const [createLine1, createLine2] = t("home.create_title").split("\n");

  return (
    <motion.div variants={container} initial="hidden" animate="show">

      {/* ── Greeting ── */}
      <motion.div variants={item} className="border-b border-ink/8 pb-7">
        <p className="text-[9px] uppercase tracking-[0.5em] text-gold">{t("home.welcome")}</p>
        <h1 className="font-display mt-2 text-6xl leading-[1.05]">
          {t("home.hello")},
          <br />
          {firstName
            ? <><em className="text-gold">{firstName}</em>.</>
            : <span className="text-smoke">…</span>}
        </h1>
        <p className="mt-3 text-sm text-smoke">
          {t("home.subtitle")}
        </p>
      </motion.div>

      {/* ── Stats inline ── */}
      <motion.div variants={item} className="flex items-center gap-5 py-6">
        {[
          { label: t("home.pieces"), value: garments.length, href: "/dressing" },
          { label: t("home.outfits"), value: outfits.length, href: "/tenues" },
          { label: t("home.rated"), value: rated, href: "/tenues" },
        ].map((s, i) => (
          <span key={s.label} className="flex items-center gap-5">
            {i > 0 && <span className="text-ink/15 select-none">·</span>}
            <Link href={s.href} className="group flex items-baseline gap-1.5">
              <span className="font-display text-3xl leading-none transition-colors group-hover:text-gold">
                {s.value}
              </span>
              <span className="text-xs text-smoke">{s.label}</span>
            </Link>
          </span>
        ))}
      </motion.div>

      {/* ── Créer une tenue ── */}
      <motion.div variants={item}>
        <Link
          href="/generer"
          className="group relative block overflow-hidden rounded-3xl bg-ink p-8 text-ivory shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-champagne/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-full bg-gradient-to-t from-black/20 to-transparent" />

          <SparklesIcon className="relative h-5 w-5 text-champagne/80" />

          <div className="relative mt-6">
            <p className="text-[9px] uppercase tracking-[0.45em] text-champagne/50">
              {t("home.create_label")}
            </p>
            <h2 className="font-display mt-2 text-5xl leading-tight">
              {createLine1}<br />{createLine2}
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ivory/50">
              {t("home.create_sub")}
            </p>
          </div>

          <div className="relative mt-8 flex items-center gap-1.5 text-sm text-champagne">
            {t("home.compose")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Travel ── */}
      <motion.div variants={item} className="mt-3">
        <Link
          href="/travel"
          className="group relative block overflow-hidden rounded-3xl bg-white p-7 shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gold/5 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.45em] text-gold">
                {t("home.travel_label")}
              </p>
              <h2 className="font-display mt-2 text-4xl leading-tight">{t("home.travel_title")}</h2>
              <p className="mt-2 max-w-xs text-sm text-smoke">{t("home.travel_sub")}</p>
            </div>
            <SuitcaseIcon className="mt-1 h-8 w-8 shrink-0 text-gold/40" />
          </div>
          <div className="relative mt-6 flex items-center gap-1.5 text-sm text-gold">
            {t("home.travel_cta")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Autour d'une pièce ── */}
      <motion.div variants={item} className="mt-3">
        <Link
          href="/dressing?pick=1"
          className="group relative block overflow-hidden rounded-3xl bg-white p-7 shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-gold/5 blur-2xl" />
          <p className="text-[9px] uppercase tracking-[0.45em] text-gold">
            {t("home.idea_label")}
          </p>
          <h2 className="font-display mt-2 text-3xl leading-tight">
            {t("home.idea_title")}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-smoke">
            {t("home.idea_sub")}
          </p>
          <div className="mt-5 flex items-center gap-1.5 text-sm text-gold">
            {t("home.idea_cta")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Avant d'acheter ── */}
      <motion.div variants={item} className="mt-3">
        <Link
          href="/shop"
          className="group relative block overflow-hidden rounded-3xl bg-white p-7 shadow-card transition hover:shadow-lift"
        >
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-terracotta/5 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-[0.45em] text-gold">{t("home.shop_label")}</p>
              <h2 className="font-display mt-2 text-3xl leading-tight">{t("home.shop_title")}</h2>
              <p className="mt-2 max-w-sm text-sm text-smoke">{t("home.shop_sub")}</p>
            </div>
            <BagIcon className="mt-1 h-8 w-8 shrink-0 text-gold/40" />
          </div>
          <div className="mt-5 flex items-center gap-1.5 text-sm text-gold">
            {t("home.shop_cta")}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-1.5">→</span>
          </div>
        </Link>
      </motion.div>

      {/* ── Dernières tenues ── */}
      <motion.div variants={item} className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">{t("home.recent")}</h2>
          {outfits.length > 0 && (
            <Link href="/tenues" className="text-sm text-gold underline-offset-4 hover:underline">
              {t("home.see_all")}
            </Link>
          )}
        </div>

        {outfits.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-sand/50 p-8 text-center">
            <HangerIcon className="mx-auto h-8 w-8 text-smoke" />
            <p className="mt-3 text-sm text-smoke">
              {t("home.no_outfits")}
            </p>
            <Link href="/generer" className="btn-primary mt-4 inline-flex">
              {t("home.first_outfit")}
            </Link>
          </div>
        ) : (
          <div className="-mx-5 mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-3 px-5" style={{ width: "max-content" }}>
              {outfits.slice(0, 8).map((o) => {
                const cover = o.items
                  .map((it) => garments.find((g) => g.id === it.garmentId)?.photo)
                  .find(Boolean);
                return (
                  <Link
                    key={o.id}
                    href="/tenues"
                    className={`group w-36 shrink-0 overflow-hidden rounded-2xl shadow-card transition hover:-translate-y-1 hover:shadow-lift ${
                      o.evening ? "bg-night" : "bg-white"
                    }`}
                  >
                    <div className="aspect-[3/4] bg-sand">
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.tryOnImage || cover}
                          alt={o.title}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      )}
                    </div>
                    <p className={`truncate px-3 py-2.5 text-xs ${
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
