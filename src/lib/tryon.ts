import { readUpload, saveImage } from "./storage";
import type { Garment } from "./types";

/**
 * Essayage virtuel réaliste via fal.ai (modèle IDM-VTON).
 * Applique séquentiellement le haut puis le bas sur la photo en pied de
 * l'utilisateur. Nécessite FAL_KEY ; sans clé, retourne null et le front
 * affiche le rendu "lookbook".
 */
export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

async function falTryOn(
  personDataUrl: string,
  garmentDataUrl: string,
  category: "upper_body" | "lower_body" | "dresses",
): Promise<string> {
  const res = await fetch("https://fal.run/fal-ai/idm-vton", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      human_image_url: personDataUrl,
      garment_image_url: garmentDataUrl,
      category,
    }),
  });
  if (!res.ok) {
    throw new Error(`Essayage virtuel indisponible (${res.status})`);
  }
  const data = await res.json();
  const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
  if (!url) throw new Error("Essayage virtuel : réponse inattendue");
  return url;
}

function toDataUrl(upload: { base64: string; mediaType: string }): string {
  return `data:${upload.mediaType};base64,${upload.base64}`;
}

export async function generateTryOn(
  personPhotoUrl: string,
  garments: Garment[],
): Promise<string | null> {
  if (!tryOnAvailable()) return null;

  const person = readUpload(personPhotoUrl);
  if (!person) throw new Error("Photo en pied introuvable");

  let current = toDataUrl(person);

  const dress = garments.find((g) => g.category === "robe");
  const top = garments.find((g) => g.category === "haut");
  const bottom = garments.find((g) => g.category === "bas");

  const steps: { garment: Garment; category: "upper_body" | "lower_body" | "dresses" }[] = [];
  if (dress) {
    steps.push({ garment: dress, category: "dresses" });
  } else {
    if (top) steps.push({ garment: top, category: "upper_body" });
    if (bottom) steps.push({ garment: bottom, category: "lower_body" });
  }

  for (const step of steps) {
    const garmentImg = readUpload(step.garment.photo);
    if (!garmentImg) continue;
    current = await falTryOn(current, toDataUrl(garmentImg), step.category);
    // Si fal renvoie une URL distante, on la télécharge pour la persister localement
    if (current.startsWith("http")) {
      const res = await fetch(current);
      const buf = Buffer.from(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "image/png";
      current = `data:${mediaType};base64,${buf.toString("base64")}`;
    }
  }

  if (!current.startsWith("data:")) return null;
  const match = /^data:([^;]+);base64,(.+)$/.exec(current);
  if (!match) return null;
  return saveImage(match[2], match[1]);
}
