"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import PhotoInput from "@/components/PhotoInput";
import { STYLES } from "@/lib/types";
import { SettingsIcon } from "@/components/icons";
import SettingsDrawer from "@/components/SettingsDrawer";
import { useT } from "@/contexts/LanguageContext";

interface Me {
  name: string;
  email: string;
  styles: string[];
  cities: string[];
  photo?: string;
  language?: string;
  country?: string;
  currency?: string;
  subscription?: string;
  promoCode?: string;
}

export default function ProfilePage() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [styles, setStyles] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  if (!me) return <p className="text-smoke">{t("evening.loading")}</p>;

  return (
    <>
    <div className="max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">{t("profile.label")}</p>
          <h1 className="font-display mt-1 text-4xl">{t("profile.title")}</h1>
          <p className="mt-2 text-sm text-smoke">
            {me.name} · {me.email}
          </p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-1 flex h-10 w-10 items-center justify-center rounded-full text-smoke hover:bg-sand transition cursor-pointer"
          aria-label="Paramètres"
        >
          <SettingsIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-10 grid gap-10 sm:grid-cols-[220px_1fr]">
        <div>
          <h2 className="font-display text-xl">{t("profile.silhouette")}</h2>
          <p className="mb-3 mt-1 text-xs text-smoke leading-relaxed">
            {t("profile.silhouette_sub")}
          </p>
          <PhotoInput value={photo} onChange={setPhoto} label={t("profile.photo_label")} />
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-display text-xl">{t("profile.styles")}</h2>
            <p className="mt-1 text-xs text-smoke">
              {t("profile.styles_sub")}
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
            <h2 className="font-display text-xl">{t("profile.cities")}</h2>
            <p className="mt-1 text-xs text-smoke">
              {t("profile.cities_sub")}
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
                  placeholder={t("profile.add_city")}
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                />
                <button className="btn-ghost !px-4 !py-2">OK</button>
              </form>
            </div>
          </section>

          <div className="flex items-center gap-4">
            <button className="btn-primary" disabled={saving} onClick={save}>
              {saving ? t("profile.saving") : t("profile.save")}
            </button>
            {saved && <span className="text-sm text-gold">{t("profile.saved")}</span>}
          </div>
        </div>
      </div>
    </div>

    <AnimatePresence>
      {settingsOpen && (
        <SettingsDrawer
          settings={{
            email: me.email,
            language: me.language ?? "fr",
            country: me.country ?? "France",
            currency: me.currency ?? "EUR",
            subscription: me.subscription ?? "free",
            promoCode: me.promoCode ?? "",
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
