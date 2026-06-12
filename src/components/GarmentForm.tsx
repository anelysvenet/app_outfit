"use client";

import { useState } from "react";
import PhotoInput from "./PhotoInput";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  CUTS,
  SEASONS,
  STYLES,
  type Category,
  type Garment,
} from "@/lib/types";

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
}: {
  existing?: Garment;
  onSaved: (garment: Garment) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null);
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
  const [error, setError] = useState<string | null>(null);

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
        throw new Error("Ajoutez une photo du vêtement.");
      }
      const payload = {
        ...draft,
        ...(isNew ? { photoDataUrl: photo } : {}),
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

  return (
    <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
      <div className="space-y-3">
        <PhotoInput
          value={photo}
          onChange={setPhoto}
          label="Photo du vêtement"
        />
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!photo?.startsWith("data:") || analyzing}
          onClick={analyze}
        >
          {analyzing ? "Analyse en cours…" : "✦ Analyser avec l'IA"}
        </button>
        <p className="text-xs text-smoke leading-relaxed">
          L&apos;IA identifie automatiquement type, coupe, couleurs, matière,
          saisons et style. Vous pouvez tout ajuster ensuite.
        </p>
      </div>

      <div className="space-y-4">
        <input
          className="field"
          placeholder="Nom du vêtement"
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
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Type (chemise, jean…)"
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
            <option value="">Coupe…</option>
            {CUTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="field"
            placeholder="Matière (coton, lin…)"
            value={draft.material}
            onChange={(e) => set("material", e.target.value)}
          />
        </div>
        <input
          className="field"
          placeholder="Couleurs (séparées par des virgules)"
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
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-smoke">Saisons</p>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle("seasons", s)}
                className={`chip ${draft.seasons.includes(s) ? "chip-active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-smoke">Styles</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle("styles", s)}
                className={`chip ${draft.styles.includes(s) ? "chip-active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <input
          className="field"
          placeholder="Marque (facultatif)"
          value={draft.brand}
          onChange={(e) => set("brand", e.target.value)}
        />
        <textarea
          className="field"
          rows={2}
          placeholder="Description courte (coupe, style, détails…)"
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
            <span className="font-display italic text-champagne">Soirée</span> —
            classer ce vêtement pour les événements et sorties nocturnes
          </span>
        </label>
        {error && <p className="text-sm text-terracotta">{error}</p>}
        <button className="btn-primary w-full" disabled={saving} onClick={save}>
          {saving ? "Enregistrement…" : existing ? "Mettre à jour" : "Ajouter au dressing"}
        </button>
      </div>
    </div>
  );
}
