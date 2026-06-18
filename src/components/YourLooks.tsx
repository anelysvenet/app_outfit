"use client";

import { useEffect, useRef, useState } from "react";
import LogoLoader from "./LogoLoader";
import { useT } from "@/contexts/LanguageContext";
import type { StyleRef } from "@/lib/types";

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
  return c.toDataURL("image/jpeg", 0.85);
}

export default function YourLooks() {
  const t = useT();
  const [refs, setRefs] = useState<StyleRef[]>([]);
  const [, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/lookbook")
      .then((r) => r.json())
      .then((d) => setRefs(d.styleRefs ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function onFile(file: File) {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/lookbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.styleRef) setRefs((prev) => [data.styleRef, ...prev]);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    setRefs((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/lookbook/${id}`, { method: "DELETE" });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl">{t("home.yourlooks_title")}</h2>
      </div>
      <p className="mt-1 max-w-md text-sm text-smoke">{t("home.yourlooks_sub")}</p>

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

      <div className="-mx-5 mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-3 px-5" style={{ width: "max-content" }}>
          {/* Add tile */}
          <button
            type="button"
            onClick={() => !uploading && inputRef.current?.click()}
            className="flex aspect-[3/4] w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-linen bg-sand/40 text-smoke transition hover:border-gold cursor-pointer"
          >
            {uploading ? (
              <LogoLoader size={40} label={t("home.yourlooks_uploading")} />
            ) : (
              <>
                <span className="text-3xl font-light">+</span>
                <span className="px-3 text-center text-xs">{t("home.yourlooks_add")}</span>
              </>
            )}
          </button>

          {/* Uploaded looks */}
          {refs.map((r) => (
            <div
              key={r.id}
              className="group relative w-36 shrink-0 overflow-hidden rounded-2xl bg-white shadow-card"
            >
              <div className="aspect-[3/4] bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.photo}
                  alt={r.description ?? ""}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                onClick={() => remove(r.id)}
                aria-label="Supprimer"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-xs text-smoke opacity-0 backdrop-blur-sm transition hover:text-terracotta group-hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
