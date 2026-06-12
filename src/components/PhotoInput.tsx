"use client";

import { useRef, useState } from "react";

/** Redimensionne l'image côté client (max 1280px) pour limiter le poids. */
async function fileToDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
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

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

export default function PhotoInput({
  value,
  onChange,
  label,
  aspect = "aspect-[3/4]",
}: {
  value: string | null;
  onChange: (dataUrl: string) => void;
  label: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setLoading(true);
          try {
            onChange(await fileToDataUrl(file));
          } finally {
            setLoading(false);
          }
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`group relative w-full ${aspect} overflow-hidden rounded-2xl border-2 border-dashed transition cursor-pointer ${
          value ? "border-transparent" : "border-linen hover:border-gold"
        } bg-sand/60`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-smoke">
            <span className="text-3xl font-light">+</span>
            <span className="text-sm">{loading ? "Chargement…" : label}</span>
          </span>
        )}
        {value && (
          <span className="absolute inset-0 flex items-center justify-center bg-night/0 text-ivory opacity-0 transition group-hover:bg-night/40 group-hover:opacity-100 text-sm">
            Changer la photo
          </span>
        )}
      </button>
    </div>
  );
}
