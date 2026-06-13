import { saveImage } from "./storage";
import type { Garment } from "./types";

export function tryOnAvailable(): boolean {
  return Boolean(process.env.FAL_KEY);
}

// IDM-VTON valid params: human_image_url, garment_image_url, description, seed
// No category, no crop — IDM-VTON infers body zone from the garment itself.
async function falTryOn(
  personUrl: string,
  garmentUrl: string,
  description?: string,
): Promise<{ url: string } | { error: string }> {
  const res = await fetch("https://fal.run/fal-ai/idm-vton", {
    method: "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      human_image_url: personUrl,
      garment_image_url: garmentUrl,
      description: description ?? "",
      seed: 42,
    }),
  });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = JSON.stringify(body);
    } catch { /* ignore */ }
    console.error("[fal.ai] error:", detail);
    return { error: detail };
  }

  const data = await res.json();
  const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
  if (!url) {
    console.error("[fal.ai] unexpected response:", JSON.stringify(data));
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

  const steps: { photoUrl: string; description: string }[] = [];
  if (dress) {
    steps.push({
      photoUrl: dress.photo,
      description: [dress.name, dress.cut, dress.colors.join(", "), dress.material]
        .filter(Boolean)
        .join(", "),
    });
  } else {
    if (top) {
      steps.push({
        photoUrl: top.photo,
        description: [top.name, top.cut, top.colors.join(", "), top.material]
          .filter(Boolean)
          .join(", "),
      });
    }
    if (bottom) {
      steps.push({
        photoUrl: bottom.photo,
        description: [bottom.name, bottom.cut, bottom.colors.join(", "), bottom.material]
          .filter(Boolean)
          .join(", "),
      });
    }
  }

  if (steps.length === 0) return null;

  let currentPersonUrl = personPhotoUrl;

  for (const step of steps) {
    const result = await falTryOn(currentPersonUrl, step.photoUrl, step.description);

    if ("error" in result) return { error: result.error };

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
