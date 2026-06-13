import { saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// Passe les URLs HTTPS publiques (Vercel Blob) directement à fal.ai.
// fal.ai n'accepte pas les data URLs base64 — il lui faut des URLs publiques.
async function falTryOn(
  personUrl: string,
  garmentUrl: string,
  category: "upper_body" | "lower_body" | "dresses",
  description?: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://fal.run/fal-ai/idm-vton", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        human_image_url: personUrl,
        garment_image_url: garmentUrl,
        category,
        description: description ?? "",
        crop: false,
        seed: 42,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.image?.url ?? data?.images?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

export async function generateTryOn(
  personPhotoUrl: string,
  garments: Garment[],
): Promise<string | null> {
  if (!tryOnAvailable()) return null;

  const dress = garments.find((g) => g.category === "robe");
  const top = garments.find((g) => g.category === "haut" || g.category === "veste");
  const bottom = garments.find((g) => g.category === "bas");

  type Step = {
    photoUrl: string;
    category: "upper_body" | "lower_body" | "dresses";
    description?: string;
  };

  const steps: Step[] = [];
  if (dress) {
    steps.push({
      photoUrl: dress.photo,
      category: "dresses",
      description: [dress.name, dress.cut, dress.colors.join(", "), dress.material]
        .filter(Boolean)
        .join(", "),
    });
  } else {
    if (top) {
      steps.push({
        photoUrl: top.photo,
        category: "upper_body",
        description: [top.name, top.cut, top.colors.join(", "), top.material]
          .filter(Boolean)
          .join(", "),
      });
    }
    if (bottom) {
      steps.push({
        photoUrl: bottom.photo,
        category: "lower_body",
        description: [bottom.name, bottom.cut, bottom.colors.join(", "), bottom.material]
          .filter(Boolean)
          .join(", "),
      });
    }
  }

  if (steps.length === 0) return null;

  // URL courante de la personne : commence par la photo de profil,
  // puis est remplacée par le résultat intermédiaire de chaque étape.
  let currentPersonUrl = personPhotoUrl;

  for (const step of steps) {
    const resultUrl = await falTryOn(
      currentPersonUrl,
      step.photoUrl,
      step.category,
      step.description,
    );
    if (!resultUrl) return null; // fal.ai indisponible → lookbook

    // Télécharge le résultat et le persist sur Vercel Blob pour la prochaine étape.
    try {
      const res = await fetch(resultUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const mediaType = res.headers.get("content-type") ?? "image/png";
      const base64 = buf.toString("base64");
      currentPersonUrl = await saveImage(base64, mediaType);
    } catch {
      return null;
    }
  }

  return currentPersonUrl === personPhotoUrl ? null : currentPersonUrl;
}
