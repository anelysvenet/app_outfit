"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import LogoLoader from "@/components/LogoLoader";
import CutoutImage from "@/components/CutoutImage";
import { BagIcon } from "@/components/icons";
import { useT } from "@/contexts/LanguageContext";
import type { Garment } from "@/lib/types";

type ShopResult = {
  item: { name: string; category: string; colors: string[]; description: string };
  outfits: { title: string; items: { garmentId: string; role: string }[]; explanation: string }[];
};

async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = document.createElement("img");
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = raw;
  });
  const MAX = 1280;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 2_000_000) return raw;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.88);
}

export default function ShopPage() {
  const t = useT();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ShopResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/garments").then((r) => r.json()).then((d) => setGarments(d.garments ?? []));
  }, []);

  async function onFile(file: File) {
    setError(null);
    setResult(null);
    const dataUrl = await fileToDataUrl(file);
    setPhoto(dataUrl);
    setLoading(true);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analyse impossible");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible");
    } finally {
      setLoading(false);
    }
  }

  const byId = new Map(garments.map((g) => [g.id, g]));

  return (
    <div className="pb-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ivory">
          <BagIcon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("shop.label")}</p>
          <h1 className="font-display text-4xl leading-none">{t("shop.title")}</h1>
        </div>
      </div>
      <p className="mt-3 max-w-lg text-sm text-smoke">{t("shop.sub")}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="mt-8 grid gap-8 sm:grid-cols-[260px_1fr]">
        {/* Item photo / uploader */}
        <div>
          {photo ? (
            <button
              onClick={() => inputRef.current?.click()}
              className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl bg-sand/60"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="" className="h-full w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center bg-night/0 text-ivory opacity-0 transition group-hover:bg-night/40 group-hover:opacity-100 text-sm">
                {t("shop.change")}
              </span>
            </button>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-linen bg-sand/40 text-smoke transition hover:border-gold cursor-pointer"
            >
              <span className="text-3xl font-light">+</span>
              <span className="px-6 text-center text-sm">{t("shop.add")}</span>
            </button>
          )}
          {result && (
            <div className="mt-3">
              <p className="font-medium">{result.item.name}</p>
              <p className="text-xs text-smoke">{result.item.description}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {loading ? (
            <div className="rounded-2xl bg-sand/40 p-6">
              <LogoLoader label={t("shop.analyzing")} />
            </div>
          ) : result ? (
            result.outfits.length === 0 ? (
              <p className="text-sm italic text-smoke">{t("shop.none")}</p>
            ) : (
              <div className="space-y-6">
                <h2 className="font-display text-2xl">{t("shop.results")}</h2>
                {result.outfits.map((o, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-2xl bg-white p-5 shadow-card"
                  >
                    <p className="font-display text-xl">{o.title}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-ivory p-3">
                      {/* The item being considered */}
                      {photo && (
                        <div className="flex flex-col items-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo} alt="" className="h-24 w-20 rounded-lg object-cover ring-2 ring-gold" />
                          <span className="mt-1 text-[9px] uppercase tracking-wider text-gold">{t("shop.the_item")}</span>
                        </div>
                      )}
                      {o.items.map((it) => {
                        const g = byId.get(it.garmentId);
                        if (!g) return null;
                        return (
                          <div key={it.garmentId} className="flex h-24 w-20 items-center justify-center">
                            <CutoutImage src={g.cutout ?? g.photo} alt={g.name} className="max-h-full max-w-full object-contain" />
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-sm text-ink/75">{o.explanation}</p>
                  </motion.div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm italic text-smoke">{t("shop.hint")}</p>
          )}
          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
        </div>
      </div>
    </div>
  );
}
