import { saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// FASHN ne sait habiller qu'une de ces trois zones par passe.
type FashnCategory = "tops" | "bottoms" | "one-pieces";

// FASHN v1.5 — essayage virtuel d'UNE pièce sur la silhouette.
// Doc: https://fal.ai/models/fal-ai/fashn/tryon/v1.5
// Points clés :
//  - `category` DOIT être explicite : en "auto" le modèle se trompe de zone
//    (un bas détouré peut être plaqué comme un haut).
//  - `mode` (et non `quality_mode`) accepte performance | balanced | quality.
//  - en v1.5 la préservation des autres vêtements est automatique (plus de
//    `restore_clothes`) : poser un "bottoms" ne touche pas au haut déjà appliqué.
async function falTryOn(
  personUrl: string,
  garmentUrl: string,
  category: FashnCategory,
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
      // Zone du corps à habiller — indispensable pour un placement correct.
      category,
      // Nos vêtements sont des images produit (fond neutre), pas des photos
      // portées ; "auto" reste robuste si une pièce ancienne n'a pas été traitée.
      garment_photo_type: "auto",
      mode: "quality",
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

  // Le modèle d'essayage ne compose QUE des vêtements (haut / bas / pièce
  // entière). Les chaussures et les accessoires (sac, sacoche, ceinture,
  // chapeau, foulard, bijoux, lunettes…) ne sont PAS supportés : les envoyer
  // plaquait n'importe quoi sur la silhouette. On les ignore donc ici.
  const onePiece = garments.find(
    (g) => g.category === "robe" || g.category === "combinaison",
  );
  const top = garments.find((g) => g.category === "haut");
  const jacket = garments.find((g) => g.category === "veste");
  const bottom = garments.find((g) => g.category === "bas");

  // Ordre des passes : couche de base d'abord, veste/manteau par-dessus.
  type Step = { url: string; category: FashnCategory; optional: boolean };
  const steps: Step[] = [];

  if (onePiece) {
    steps.push({ url: onePiece.photo, category: "one-pieces", optional: false });
  } else {
    if (top) steps.push({ url: top.photo, category: "tops", optional: false });
    if (bottom) steps.push({ url: bottom.photo, category: "bottoms", optional: false });
  }
  // Veste/manteau = couche supérieure posée par-dessus le haut ou la robe.
  // Optionnelle seulement s'il y a déjà une autre pièce du haut (sinon c'est
  // la seule pièce et son échec doit remonter).
  if (jacket) {
    steps.push({
      url: jacket.photo,
      category: "tops",
      optional: Boolean(onePiece || top),
    });
  }

  if (steps.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  for (const step of steps) {
    const result = await falTryOn(currentPersonUrl, step.url, step.category);

    if ("error" in result) {
      if (step.optional) {
        // Couche optionnelle échouée → on garde le résultat courant et on continue.
        console.warn("[fashn] optional step skipped:", result.error);
        continue;
      }
      return { error: result.error };
    }

    // Persiste le résultat sur le stockage pour servir d'entrée à la passe suivante.
    try {
      const res = await fetch(result.url);
      if (!res.ok) {
        if (step.optional) continue;
        return { error: `download failed: ${res.status}` };
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "image/png";
      currentPersonUrl = await saveImage(buf.toString("base64"), mediaType);
    } catch (e) {
      if (step.optional) continue;
      return { error: e instanceof Error ? e.message : "download error" };
    }
  }

  if (currentPersonUrl === personPhotoUrl) return null;
  return { image: currentPersonUrl };
}
