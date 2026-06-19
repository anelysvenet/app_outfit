"use client";

import { useRef, useState } from "react";
import PhotoInput from "./PhotoInput";
import { useT } from "@/contexts/LanguageContext";
import {
  CATEGORIES,
  CUTS,
  SEASONS,
  STYLES,
  type Category,
  type Garment,
} from "@/lib/types";

// Map category values to i18n keys
const CATEGORY_KEYS: Record<Category, string> = {
  haut: "cat.haut",
  bas: "cat.bas",
  robe: "cat.robe",
  combinaison: "cat.combinaison",
  veste: "cat.veste",
  chaussures: "cat.chaussures",
  sac: "cat.sac",
  sacoche: "cat.sacoche",
  ceinture: "cat.ceinture",
  chapeau: "cat.chapeau",
  bijoux: "cat.bijoux",
  lunettes: "cat.lunettes",
  foulard: "cat.foulard",
  accessoire: "cat.accessoire",
};

// Map season values to i18n keys
const SEASON_KEYS: Record<string, string> = {
  printemps: "season.printemps",
  été: "season.ete",
  automne: "season.automne",
  hiver: "season.hiver",
};

export interface GarmentDraft {
  photoDataUrl?: string;
  name: string;
  category: Category;
  type: string;
  cut: string;
  colors: string[];
  material: string;
  seasons: string[];
  styles: string[];
  brand: string;
  description: string;
  evening: boolean;
}

function emptyDraft(): GarmentDraft {
  return {
    name: "",
    category: "haut",
    type: "",
    cut: "",
    colors: [],
    material: "",
    seasons: [],
    styles: [],
    brand: "",
    description: "",
    evening: false,
  };
}

export default function GarmentForm({
  existing,
  onSaved,
  onDeleted,
}: {
  existing?: Garment;
  onSaved: (garment: Garment) => void;
  onDeleted?: (id: string) => void;
}) {
  const t = useT();
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [draft, setDraft] = useState<GarmentDraft>(
    existing
      ? {
          name: existing.name,
          category: existing.category,
          type: existing.type,
          cut: existing.cut,
          colors: existing.colors,
          material: existing.material,
          seasons: existing.seasons,
          styles: existing.styles,
          brand: existing.brand ?? "",
          description: existing.description ?? "",
          evening: existing.evening,
        }
      : emptyDraft(),
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof GarmentDraft>(key: K, value: GarmentDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggle = (key: "seasons" | "styles" | "colors", value: string) =>
    setDraft((d) => ({
      ...d,
      [key]: d[key].includes(value)
        ? d[key].filter((x) => x !== value)
        : [...d[key], value],
    }));

  async function analyze() {
    if (!photo || !photo.startsWith("data:")) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/garments/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: photo }),
      });
      // Le corps peut être vide ou non-JSON en cas d'erreur serveur (500/413…)
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Analyse impossible (erreur ${res.status})`);
      }
      const a = data.analysis;
      setDraft((d) => ({
        ...d,
        name: a.name ?? d.name,
        category: a.category ?? d.category,
        type: a.type ?? d.type,
        cut: a.cut ?? d.cut,
        colors: a.colors ?? d.colors,
        material: a.material ?? d.material,
        seasons: a.seasons ?? d.seasons,
        styles: a.styles ?? d.styles,
        evening: a.eveningSuitable ?? d.evening,
        description: a.description ?? d.description,
      }));
      // Scroll to the filled-in details so the user sees the analysis worked
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyse impossible");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const isNew = !existing;
      if (isNew && (!photo || !photo.startsWith("data:"))) {
        throw new Error(t("form.photo_required"));
      }
      // Send the photo whenever it's a fresh data URL (new upload, or an edited
      // crop/rotation of an existing garment) so changes persist.
      const payload = {
        ...draft,
        ...(photo?.startsWith("data:") ? { photoDataUrl: photo } : {}),
        ...(cutout?.startsWith("data:") ? { cutoutDataUrl: cutout } : {}),
      };
      const res = await fetch(
        isNew ? "/api/garments" : `/api/garments/${existing.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Enregistrement impossible (erreur ${res.status})`);
      }
      onSaved(data.garment);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/garments/${existing.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Suppression impossible (erreur ${res.status})`);
      }
      onDeleted?.(existing.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
      <div className="space-y-3">
        <PhotoInput
          value={photo}
          onChange={setPhoto}
          onCutout={setCutout}
          label={t("form.photo_label")}
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!photo?.startsWith("data:") || analyzing}
          onClick={analyze}
        >
          {analyzing ? t("form.analyzing") : t("form.analyze")}
        </button>
        <p className="text-xs text-smoke leading-relaxed">
          {t("form.analyze_sub")}
        </p>
      </div>

      <div className="space-y-4" ref={detailRef}>
        <input
          className="field"
          placeholder={t("form.name_placeholder")}
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <select
            className="field"
            value={draft.category}
            onChange={(e) => set("category", e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(CATEGORY_KEYS[c])}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder={t("form.type_placeholder")}
            value={draft.type}
            onChange={(e) => set("type", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            className="field"
            value={draft.cut}
            onChange={(e) => set("cut", e.target.value)}
          >
            <option value="">{t("form.cut_placeholder")}</option>
            {CUTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder={t("form.material_placeholder")}
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
          />
        </div>
        <input
          className="field"
          placeholder={t("form.colors_placeholder")}
          value={draft.colors.join(", ")}
          onChange={(e) =>
            set(
              "colors",
              e.target.value
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
            )
          }
        />
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-smoke">{t("form.seasons")}</p>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle("seasons", s)}
                className={`chip ${draft.seasons.includes(s) ? "chip-active" : ""}`}
              >
                {t(SEASON_KEYS[s] ?? s)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-smoke">{t("form.styles")}</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle("styles", s)}
                className={`chip ${draft.styles.includes(s) ? "chip-active" : ""}`}
              >
                {t(`style.${s}`)}
              </button>
            ))}
          </div>
        </div>
        <input
          className="field"
          placeholder={t("form.brand_placeholder")}
          value={draft.brand}
          onChange={(e) => set("brand", e.target.value)}
        />
        <textarea
          className="field"
          rows={2}
          placeholder={t("form.description_placeholder")}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <label className="flex items-center gap-3 rounded-xl bg-night px-4 py-3 text-sm text-ivory cursor-pointer">
          <input
            type="checkbox"
            checked={draft.evening}
            onChange={(e) => set("evening", e.target.checked)}
            className="h-4 w-4 accent-[#d8c39a]"
          />
          <span>
            <span className="font-display italic text-champagne">{t("form.evening_label")}</span> —
            {t("form.evening_sub")}
          </span>
        </label>
        {error && <p className="text-sm text-terracotta">{error}</p>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>
          {saving ? t("form.saving") : existing ? t("form.update") : t("form.save")}
        </button>

        {existing && onDeleted && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5ede4] px-4 py-3 text-sm font-medium text-terracotta transition hover:bg-terracotta/10 cursor-pointer disabled:opacity-60"
            style={{
              border: "1.5px solid #DDB8A8",
              boxShadow: "0 0 6px #DDB8A8, 0 0 16px rgba(221,184,168,0.55)",
            }}
          >
            <span className="text-xs">✕</span>
            {deleting ? t("form.deleting") : t("form.delete_garment")}
          </button>
        )}
      </div>
    </div>
  );
}
