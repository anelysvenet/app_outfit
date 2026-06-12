"use client";

import { useEffect, useState } from "react";
import PhotoInput from "@/components/PhotoInput";
import { STYLES } from "@/lib/types";

interface Me {
  name: string;
  email: string;
  styles: string[];
  cities: string[];
  photo?: string;
}

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user);
        setStyles(d.user?.styles ?? []);
        setCities(d.user?.cities ?? []);
        setPhoto(d.user?.photo ?? null);
      });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    const body: Record<string, unknown> = { styles, cities };
    if (photo?.startsWith("data:")) body.photoDataUrl = photo;
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json();
      setMe(data.user);
      setPhoto(data.user.photo ?? null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  if (!me) return <p className="text-smoke">Chargement…</p>;

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">Préférences</p>
      <h1 className="font-display mt-1 text-4xl">Profil</h1>
      <p className="mt-2 text-sm text-smoke">
        {me.name} · {me.email}
      </p>

      <div className="mt-10 grid gap-10 sm:grid-cols-[220px_1fr]">
        <div>
          <h2 className="font-display text-xl">Ma silhouette</h2>
          <p className="mb-3 mt-1 text-xs text-smoke leading-relaxed">
            Photo en pied utilisée pour l&apos;essayage virtuel des tenues.
          </p>
          <PhotoInput value={photo} onChange={setPhoto} label="Photo en pied" />
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl">Mes styles</h2>
            <p className="mt-1 text-xs text-smoke">
              L&apos;IA compose vos tenues selon ces styles.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    setStyles((prev) =>
                      prev.includes(s)
                        ? prev.filter((x) => x !== s)
                        : [...prev, s],
                    )
                  }
                  className={`chip ${styles.includes(s) ? "chip-active" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-xl">Mes villes</h2>
            <p className="mt-1 text-xs text-smoke">
              Raccourcis météo pour la génération de tenues.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {cities.map((c) => (
                <span key={c} className="chip chip-active !cursor-default">
                  {c}
                  <button
                    onClick={() => setCities((prev) => prev.filter((x) => x !== c))}
                    className="ml-2 text-ivory/60 hover:text-terracotta cursor-pointer"
                    aria-label={`Retirer ${c}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const c = cityInput.trim();
                  if (c && !cities.includes(c)) setCities((prev) => [...prev, c]);
                  setCityInput("");
                }}
              >
                <input
                  className="field !w-44 !py-2"
                  placeholder="Ajouter une ville…"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
                <button className="btn-ghost !px-4 !py-2">OK</button>
              </form>
            </div>
          </section>

          <div className="flex items-center gap-4">
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            {saved && <span className="text-sm text-gold">✓ Profil mis à jour</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
