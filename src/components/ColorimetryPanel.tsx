"use client";

import { useRef, useState } from "react";
import LogoLoader from "./LogoLoader";
import { useT } from "@/contexts/LanguageContext";
import type { Colorimetry, ColorSwatch } from "@/lib/types";

// Fallback name -> hex (EN + FR) for when the AI didn't return a hex
const NAME_HEX: Record<string, string> = {
  // neutrals
  black: "#1c1917", noir: "#1c1917", white: "#f8f5f0", blanc: "#f8f5f0",
  ivory: "#f1e9d8", ivoire: "#f1e9d8", cream: "#f2ead9", creme: "#f2ead9",
  beige: "#d8c4a5", sand: "#dcc9a8", camel: "#b08d57", tan: "#c8a878",
  taupe: "#8b7d6b", brown: "#6b4a2b", marron: "#6b4a2b", chocolate: "#4a2f1c",
  grey: "#9aa0a6", gray: "#9aa0a6", gris: "#9aa0a6", charcoal: "#3a3f44",
  anthracite: "#3a3f44", slate: "#5a6470", silver: "#c0c0c0", argent: "#c0c0c0",
  // blues
  navy: "#1f2a44", marine: "#1f2a44", blue: "#3b6ea5", bleu: "#3b6ea5",
  periwinkle: "#8f9fd1", cobalt: "#274690", teal: "#2f7d7a", turquoise: "#3fb6b2",
  // greens
  green: "#3f7d54", vert: "#3f7d54", sage: "#9caf88", sauge: "#9caf88",
  emerald: "#1f7a5a", emeraude: "#1f7a5a", olive: "#6b6f3a", forest: "#2f5d3a",
  mint: "#a8d5ba", kaki: "#7a7350", khaki: "#7a7350",
  // reds / pinks / purples
  red: "#b23b3b", rouge: "#b23b3b", burgundy: "#6e2433", bordeaux: "#6e2433",
  coral: "#e6766b", corail: "#e6766b", pink: "#e3a3b5", rose: "#e3a3b5",
  blush: "#e7c4c8", fuchsia: "#b23a82", mauve: "#b08ca0", purple: "#6b4a8a",
  violet: "#6b4a8a", lavender: "#b9a7d6", lavande: "#b9a7d6", plum: "#5e2e4d",
  prune: "#5e2e4d",
  // warm
  yellow: "#e9c44c", jaune: "#e9c44c", mustard: "#c79a3a", moutarde: "#c79a3a",
  gold: "#c9a534", orange: "#d97a3a", peach: "#f0bf9b", peche: "#f0bf9b",
  terracotta: "#c06a4a", apricot: "#e8a26a",
};
// modifiers that lighten / mute the base hue
const LIGHTEN = ["soft", "powder", "pale", "light", "dusty", "muted", "pastel", "doux", "clair", "pale"];

function clampByte(v: number) {
  return Math.max(0, Math.min(255, Math.round(v)));
}
function lighten(hex: string, f: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => clampByte(c + (255 - c) * f);
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, "0")}`;
}

function normalize(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function hexFor(name: string): string {
  const norm = normalize(name);
  let base = NAME_HEX[norm];
  if (!base) {
    // longest keyword contained in the name wins
    const key = Object.keys(NAME_HEX)
      .filter((k) => norm.includes(k))
      .sort((a, b) => b.length - a.length)[0];
    base = key ? NAME_HEX[key] : "#c9bfb0";
  }
  if (LIGHTEN.some((m) => norm.includes(m))) base = lighten(base, 0.28);
  return base;
}

function isHex(s?: string) {
  return !!s && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
}

// Tolerates legacy data (string) and missing/invalid hex
function toSwatch(c: ColorSwatch | string): ColorSwatch {
  if (typeof c === "string") return { name: c, hex: hexFor(c) };
  return { name: c.name, hex: isHex(c.hex) ? c.hex : hexFor(c.name) };
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
