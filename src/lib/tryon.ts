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
  restoreClothes = false,
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
      // Préserve les vêtements déjà appliqués lors des passes successives
      restore_clothes: restoreClothes,
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
  // Accessoires portables que FASHN peut composer sur la silhouette
  const bag = garments.find((g) => g.category === "sac" || g.category === "sacoche");
  const belt = garments.find((g) => g.category === "ceinture");
  const hat = garments.find((g) => g.category === "chapeau");
  const scarf = garments.find((g) => g.category === "foulard");

  // Ordre : vêtements (critiques) puis accessoires (optionnels).
  // restoreClothes=true à partir de la 2e passe pour éviter la dérive de couleur.
  type Step = { url: string; optional: boolean };
  const steps: Step[] = [];
  if (dress) {
    steps.push({ url: dress.photo, optional: false });
  } else {
    if (top) steps.push({ url: top.photo, optional: false });
    if (bottom) steps.push({ url: bottom.photo, optional: false });
  }
  if (belt)  steps.push({ url: belt.photo,  optional: true });
  if (scarf) steps.push({ url: scarf.photo, optional: true });
  if (hat)   steps.push({ url: hat.photo,   optional: true });
  if (bag)   steps.push({ url: bag.photo,   optional: true });

  if (steps.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  for (let i = 0; i < steps.length; i++) {
    const { url: garmentUrl, optional } = steps[i];
    // À partir de la 2e passe, demander à FASHN de préserver les vêtements déjà appliqués
    const result = await falTryOn(currentPersonUrl, garmentUrl, i > 0);

    if ("error" in result) {
      if (optional) {
        // Accessoire échoué → on garde le résultat actuel et on continue
        console.warn("[fashn] optional step skipped:", result.error);
        continue;
      }
      return { error: result.error };
    }

    // Persiste le résultat sur Vercel Blob pour l'étape suivante.
    try {
      const res = await fetch(result.url);
      if (!res.ok) {
        if (optional) { continue; }
        return { error: `download failed: ${res.status}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "image/png";
      currentPersonUrl = await saveImage(buf.toString("base64"), mediaType);
    } catch (e) {
      if (optional) { continue; }
      return { error: e instanceof Error ? e.message : "download error" };
    }
  }

  if (currentPersonUrl === personPhotoUrl) return null;
  return { image: currentPersonUrl };
}
