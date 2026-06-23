"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import LogoLoader from "./LogoLoader";
import { useT } from "@/contexts/LanguageContext";
import type { Morphology } from "@/lib/types";

export default function MorphologyPanel({
  initial,
  hasPhoto,
}: {
  initial?: Morphology | null;
  hasPhoto: boolean;
}) {
  const t = useT();
  const [result, setResult] = useState<Morphology | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvice, setShowAdvice] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/morphology", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Analyse impossible");
      setResult(data.morphology);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-xl">{t("morpho.title")}</h2>
        <span className="text-[10px] uppercase tracking-widest text-smoke">
          {t("colorimetry.optional")}
        </span>
      </div>
      <p className="mt-1 text-xs text-smoke leading-relaxed">{t("morpho.sub")}</p>

      {loading ? (
        <div className="mt-4 rounded-2xl bg-sand/50 p-6">
          <LogoLoader size={44} label={t("morpho.analyzing")} />
        </div>
      ) : result ? (
        <div className="mt-4 rounded-2xl bg-sand/50 p-5">
          <p className="font-display text-2xl">{result.shape}</p>
          <p className="mt-2 text-sm text-ink/75 leading-relaxed">{result.description}</p>

          <button
            onClick={() => setShowAdvice((s) => !s)}
            className="mt-4 flex items-center gap-2 text-sm text-gold cursor-pointer"
          >
            <motion.span animate={{ rotate: showAdvice ? 180 : 0 }} transition={{ duration: 0.2 }}>
              ▾
            </motion.span>
            {t("morpho.advice")}
          </button>
          <AnimatePresence initial={false}>
            {showAdvice && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="mt-2 space-y-1.5 overflow-hidden"
              >
                {result.advice.map((a, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink/80">
                    <span className="text-gold">✦</span>
                    <span>{a}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>

          <button
            onClick={analyze}
            className="mt-5 block text-xs text-gold underline-offset-4 hover:underline cursor-pointer"
          >
            {t("morpho.redo")}
          </button>
        </div>
      ) : (
        <button
          onClick={analyze}
          disabled={!hasPhoto}
          className="btn-primary mt-4 disabled:opacity-40"
        >
          {t("morpho.analyze")}
        </button>
      )}
      {!hasPhoto && !result && (
        <p className="mt-2 text-xs text-smoke italic">{t("morpho.need_photo")}</p>
      )}
      {error && <p className="mt-2 text-xs text-terracotta">{error}</p>}
    </section>
  );
}
