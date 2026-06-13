import { saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// FASHN v1 — meilleur modèle pour le virtual try-on avec catégories (tops/bottoms/full-body).
// Doc: https://fal.ai/models/fal-ai/fashn/tryon
async function falTryOn(
  personUrl: string,
  garmentUrl: string,
  category: "tops" | "bottoms" | "full-body",
): Promise<{ url: string } | { error: string }> {
  const res = await fetch("https://fal.run/fal-ai/fashn/tryon", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_image: personUrl,
      garment_image: garmentUrl,
      category,
      flat_lay: false,
      adjust_hands: false,
      restore_background: true,
      restore_clothes: false,
      num_inference_steps: 50,
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
  const url: string | undefined = data?.images?.[0]?.url ?? data?.image?.url;
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

  const steps: { photoUrl: string; category: "tops" | "bottoms" | "full-body" }[] = [];
  if (dress) {
    steps.push({ photoUrl: dress.photo, category: "full-body" });
  } else {
    if (top) steps.push({ photoUrl: top.photo, category: "tops" });
    if (bottom) steps.push({ photoUrl: bottom.photo, category: "bottoms" });
  }

  if (steps.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  for (const step of steps) {
    const result = await falTryOn(currentPersonUrl, step.photoUrl, step.category);
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
