import { readUpload, saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

async function falTryOn(
  personDataUrl: string,
  garmentDataUrl: string,
  category: "upper_body" | "lower_body" | "dresses",
): Promise<string | null> {
  try {
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
    if (!res.ok) return null; // 403 clé invalide, 429 quota, etc. → lookbook
    const data = await res.json();
    return data?.image?.url ?? data?.images?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

function toDataUrl(upload: { base64: string; mediaType: string }): string {
  return `data:${upload.mediaType};base64,${upload.base64}`;
}

export async function generateTryOn(
  personPhotoUrl: string,
  garments: Garment[],
): Promise<string | null> {
  if (!tryOnAvailable()) return null;

  const person = await readUpload(personPhotoUrl);
  if (!person) return null;

  let current = toDataUrl(person);

  const dress = garments.find((g) => g.category === "robe");
  const top = garments.find((g) => g.category === "haut" || g.category === "veste");
  const bottom = garments.find((g) => g.category === "bas");

  const steps: { garment: Garment; category: "upper_body" | "lower_body" | "dresses" }[] = [];
  if (dress) {
    steps.push({ garment: dress, category: "dresses" });
  } else {
    if (top) steps.push({ garment: top, category: "upper_body" });
    if (bottom) steps.push({ garment: bottom, category: "lower_body" });
  }

  for (const step of steps) {
    const garmentImg = await readUpload(step.garment.photo);
    if (!garmentImg) continue;
    const result = await falTryOn(current, toDataUrl(garmentImg), step.category);
    if (!result) return null; // fal.ai indisponible → lookbook
    current = result;
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
  return await saveImage(match[2], match[1]);
}
