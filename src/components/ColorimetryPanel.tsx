"use client";

import { useRef, useState } from "react";
import LogoLoader from "./LogoLoader";
import { useT } from "@/contexts/LanguageContext";
import type { Colorimetry, ColorSwatch } from "@/lib/types";

// Tolerates legacy data where a colour was just a string
function toSwatch(c: ColorSwatch | string): ColorSwatch {
  if (typeof c === "string") return { name: c, hex: "#c9bfb0" };
  return { name: c.name, hex: c.hex || "#c9bfb0" };
}

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
  const MAX = 900;
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  if (scale === 1 && file.size < 1_500_000) return raw;
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function ColorimetryPanel({ initial }: { initial?: Colorimetry | null }) {
  const t = useT();
  const [result, setResult] = useState<Colorimetry | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/colorimetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analyse impossible");
      setResult(data.colorimetry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-xl">{t("colorimetry.title")}</h2>
        <span className="text-[10px] uppercase tracking-widest text-smoke">
          {t("colorimetry.optional")}
        </span>
      </div>
      <p className="mt-1 text-xs text-smoke leading-relaxed">{t("colorimetry.sub")}</p>

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

      {loading ? (
        <div className="mt-4 rounded-2xl bg-sand/50 p-6">
          <LogoLoader size={44} label={t("colorimetry.analyzing")} />
        </div>
      ) : result ? (
        <div className="mt-4 rounded-2xl bg-sand/50 p-5">
          {/* Draping — la photo du visage avec la palette « drapée » dessous */}
          {result.photo && (
            <div className="mb-4 overflow-hidden rounded-xl">
              <div className="relative aspect-[4/5] w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.photo} alt="" className="h-full w-full object-cover" />
                {/* Bande de couleurs recommandées, comme un tissu drapé sous le visage */}
                <div className="absolute inset-x-0 bottom-0 flex h-[30%]">
                  {result.palette.slice(0, 7).map((c, i) => (
                    <div key={i} className="flex-1" style={{ background: toSwatch(c).hex }} />
                  ))}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/15 to-transparent" />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-2xl">{result.season}</p>
            <span className="text-xs uppercase tracking-widest text-gold">
              {t("colorimetry.undertone")} · {result.undertone}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink/75 leading-relaxed">{result.description}</p>

          <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-smoke">
            {t("colorimetry.flattering")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {result.palette.map((raw, i) => {
              const c = toSwatch(raw);
              return (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs shadow-card"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                    style={{ background: c.hex }}
                  />
                  {c.name}
                </span>
              );
            })}
          </div>

          {result.avoid?.length > 0 && (
            <>
              <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-smoke">
                {t("colorimetry.avoid")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {result.avoid.map((raw, i) => {
                  const c = toSwatch(raw);
                  return (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-xs text-smoke line-through"
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                        style={{ background: c.hex }}
                      />
                      {c.name}
                    </span>
                  );
                })}
              </div>
            </>
          )}

          <button
            onClick={() => inputRef.current?.click()}
            className="mt-5 text-xs text-gold underline-offset-4 hover:underline cursor-pointer"
          >
            {t("colorimetry.redo")}
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-linen bg-sand/40 px-4 py-8 text-smoke transition hover:border-gold cursor-pointer"
        >
          <span className="text-2xl font-light">+</span>
          <span className="text-sm">{t("colorimetry.add")}</span>
          <span className="px-4 text-center text-[11px] text-smoke/80">{t("colorimetry.hint")}</span>
        </button>
      )}

      {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
    </section>
  );
}
