import { saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// FASHN v1.5 — détecte automatiquement le type de vêtement (haut/bas/robe).
// Doc: https://fal.ai/models/fal-ai/fashn/tryon/v1.5
async function falTryOn(
  personUrl: string,
  garmentUrl: string,
): Promise<{ url: string } | { error: string }> {
  const res = await fetch("https://fal.run/fal-ai/fashn/tryon/v1.5", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_image: personUrl,
      garment_image: garmentUrl,
      garment_photo_type: "auto",
      quality_mode: "quality",
      seed: 42,
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    console.error("[fashn] error:", detail);
    return { error: detail };
  }

  const data = await res.json();
  const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
  if (!url) {
    console.error("[fashn] unexpected response:", JSON.stringify(data));
    return { error: "no image in response" };
  }
  return { url };
}

export async function generateTryOn(
  personPhotoUrl: string,
  garments: Garment[],
): Promise<{ image: string } | { error: string } | null> {
  if (!tryOnAvailable()) return null;

  const dress = garments.find((g) => g.category === "robe");
  const top = garments.find((g) => g.category === "haut" || g.category === "veste");
  const bottom = garments.find((g) => g.category === "bas");

  // FASHN détecte automatiquement le type de vêtement — pas besoin de catégorie.
  const steps: string[] = [];
  if (dress) {
    steps.push(dress.photo);
  } else {
    if (top) steps.push(top.photo);
    if (bottom) steps.push(bottom.photo);
  }

  if (steps.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  for (const garmentUrl of steps) {
    const result = await falTryOn(currentPersonUrl, garmentUrl);
    if ("error" in result) return { error: result.error };

    // Persiste le résultat sur Vercel Blob pour l'étape suivante.
    try {
      const res = await fetch(result.url);
      if (!res.ok) return { error: `download failed: ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "image/png";
      currentPersonUrl = await saveImage(buf.toString("base64"), mediaType);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "download error" };
    }
  }

  if (currentPersonUrl === personPhotoUrl) return null;
  return { image: currentPersonUrl };
}
