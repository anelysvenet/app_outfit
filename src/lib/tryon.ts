import { saveImage } from "./storage";
import type { Category, Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// Les accessoires/chaussures passent par un modèle d'édition facturé à l'usage
// (sur la même clé fal.ai). Désactivés par défaut pour ne RIEN coûter de plus :
// mettre FAL_ACCESSORIES=1 (ou true/on) pour les activer.
function accessoriesEnabled(): boolean {
  const v = (process.env.FAL_ACCESSORIES || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

// Modèle d'édition d'image pour AJOUTER les accessoires sur la silhouette déjà
// habillée. Configurable : passez à `fal-ai/nano-banana-pro/edit` (Gemini 3,
// plus précis pour les cas durs comme les chaussures) pour plus de qualité.
const EDIT_MODEL = process.env.FAL_EDIT_MODEL || "fal-ai/nano-banana/edit";

// FASHN ne sait habiller qu'une de ces trois zones par passe.
type FashnCategory = "tops" | "bottoms" | "one-pieces";

// Télécharge le résultat d'une passe fal.ai et le persiste sur le stockage,
// pour servir d'entrée (URL publique) à la passe suivante.
async function storeResult(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const mediaType = res.headers.get("content-type") ?? "image/png";
  return saveImage(buf.toString("base64"), mediaType);
}

// FASHN v1.5 — essayage virtuel d'UNE pièce de vêtement sur la silhouette.
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

// FASHN ne gère NI les chaussures NI les accessoires. On les ajoute donc par
// ÉDITION d'image : on fournit la silhouette habillée + les photos des
// accessoires comme références, et on demande au modèle de les faire porter
// sans rien changer d'autre. `image_urls[0]` = la personne, le reste = les
// accessoires (dans le même ordre que décrit dans le prompt).
// Doc: https://fal.ai/models/fal-ai/nano-banana/edit/api
async function falEdit(
  imageUrls: string[],
  prompt: string,
): Promise<{ url: string } | { error: string }> {
  const res = await fetch(`https://fal.run/${EDIT_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      output_format: "png",
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    console.error("[edit] error:", detail);
    return { error: detail };
  }

  const data = await res.json();
  const url: string | undefined = data?.images?.[0]?.url ?? data?.image?.url;
  if (!url) {
    console.error("[edit] unexpected response:", JSON.stringify(data));
    return { error: "no image in response" };
  }
  return { url };
}

// Catégories traitées comme accessoires (tout sauf les vraies pièces de
// vêtement gérées par FASHN). L'ordre sert juste à un prompt déterministe.
const ACCESSORY_ORDER: Category[] = [
  "ceinture",
  "foulard",
  "chaussures",
  "sac",
  "sacoche",
  "chapeau",
  "lunettes",
  "bijoux",
  "accessoire",
];
const ACCESSORY_SET = new Set<Category>(ACCESSORY_ORDER);

// Description (en anglais — meilleurs résultats) du PLACEMENT attendu de chaque
// type d'accessoire, injectée dans le prompt d'édition.
const ACCESSORY_PLACEMENT: Record<string, string> = {
  lunettes: "the eyewear (glasses or sunglasses) on the face, resting on the nose and ears",
  chapeau: "the hat or cap on the head, sitting over the hair at a natural angle",
  bijoux: "the jewelry where it belongs (a necklace around the neck, earrings on the ears, a bracelet or watch on the wrist)",
  foulard: "the scarf draped naturally around the neck",
  ceinture: "the belt around the waist, over the clothing",
  sac: "the handbag carried in the hand or hanging from the shoulder by its strap",
  sacoche: "the bag worn crossbody, with the strap across the torso",
  chaussures: "the shoes on both feet, replacing any current footwear, at a realistic size and perspective",
  accessoire: "the accessory placed on the person in the most natural, realistic way",
};

export async function generateTryOn(
  personPhotoUrl: string,
  garments: Garment[],
): Promise<{ image: string } | { error: string } | null> {
  if (!tryOnAvailable()) return null;

  // ---- 1) Vêtements via FASHN (haut / bas / robe / veste) -----------------
  const onePiece = garments.find(
    (g) => g.category === "robe" || g.category === "combinaison",
  );
  const top = garments.find((g) => g.category === "haut");
  const jacket = garments.find((g) => g.category === "veste");
  const bottom = garments.find((g) => g.category === "bas");

  // Ordre des passes : couche de base d'abord, veste/manteau par-dessus.
  type Step = { url: string; category: FashnCategory; optional: boolean };
  const clothingSteps: Step[] = [];

  if (onePiece) {
    clothingSteps.push({ url: onePiece.photo, category: "one-pieces", optional: false });
  } else {
    if (top) clothingSteps.push({ url: top.photo, category: "tops", optional: false });
    if (bottom) clothingSteps.push({ url: bottom.photo, category: "bottoms", optional: false });
  }
  // Veste/manteau = couche supérieure posée par-dessus le haut ou la robe.
  // Optionnelle seulement s'il y a déjà une autre pièce du haut (sinon c'est
  // la seule pièce et son échec doit remonter).
  if (jacket) {
    clothingSteps.push({
      url: jacket.photo,
      category: "tops",
      optional: Boolean(onePiece || top),
    });
  }

  // ---- 2) Chaussures + accessoires via édition d'image (OPT-IN) -----------
  // Désactivé par défaut (coût à l'usage) → activer avec FAL_ACCESSORIES=1.
  // Toutes les pièces d'accessoire de la tenue (plusieurs bijoux possibles),
  // triées pour un prompt stable. Plafonné : trop d'images de référence dégrade
  // la qualité de l'édition.
  const accessories = accessoriesEnabled()
    ? garments
        .filter((g) => ACCESSORY_SET.has(g.category))
        .sort(
          (a, b) =>
            ACCESSORY_ORDER.indexOf(a.category) -
            ACCESSORY_ORDER.indexOf(b.category),
        )
        .slice(0, 6)
    : [];

  if (clothingSteps.length === 0 && accessories.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  // --- Passes vêtements (critiques) ---
  for (const step of clothingSteps) {
    const result = await falTryOn(currentPersonUrl, step.url, step.category);

    if ("error" in result) {
      if (step.optional) {
        console.warn("[fashn] optional step skipped:", result.error);
        continue;
      }
      return { error: result.error };
    }

    try {
      currentPersonUrl = await storeResult(result.url);
    } catch (e) {
      if (step.optional) continue;
      return { error: e instanceof Error ? e.message : "download error" };
    }
  }

  // --- Passe accessoires (une seule édition, non bloquante) ---
  // On les ajoute tous d'un coup : moins de passes = moins de dérive du visage,
  // et le modèle associe chaque référence à sa description par ressemblance.
  if (accessories.length > 0) {
    const list = accessories
      .map((g, i) => {
        const placement = ACCESSORY_PLACEMENT[g.category] ?? ACCESSORY_PLACEMENT.accessoire;
        // Image n°(i+2) car image_urls[0] est la personne.
        return `- ${placement} (shown in reference image ${i + 2})`;
      })
      .join("\n");

    const prompt =
      "You are editing the FIRST image: a full-body photo of a person who is already dressed. " +
      "Make the SAME person additionally wear or carry the following items, each provided as a separate reference image:\n" +
      `${list}\n` +
      "Strict rules: keep the person's face, identity, hair, skin tone, body shape and pose EXACTLY the same; " +
      "keep ALL the clothing they already wear unchanged; keep the lighting and the background EXACTLY the same; " +
      "do not duplicate the person and do not add anything that is not listed. " +
      "Each added item must match its reference image and be rendered photorealistically, at the correct scale, perspective and placement.";

    const imageUrls = [currentPersonUrl, ...accessories.map((g) => g.photo)];
    const result = await falEdit(imageUrls, prompt);

    if ("error" in result) {
      // L'essayage des vêtements reste valable : on ne fait pas échouer le tout.
      console.warn("[edit] accessories skipped:", result.error);
    } else {
      try {
        currentPersonUrl = await storeResult(result.url);
      } catch (e) {
        console.warn("[edit] store failed:", e instanceof Error ? e.message : e);
      }
    }
  }

  if (currentPersonUrl === personPhotoUrl) return null;
  return { image: currentPersonUrl };
}
