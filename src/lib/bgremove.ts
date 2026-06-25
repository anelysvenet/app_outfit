import { saveImage } from "./storage";

/**
 * Removes the background of an image via fal.ai BiRefNet and returns a
 * transparent PNG data URL. Returns null if fal isn't configured or fails.
 */
export async function removeBackgroundToDataUrl(
  base64: string,
  mediaType: string,
): Promise<string | null> {
  if (!process.env.FAL_KEY) return null;
  try {
    const imageUrl = await saveImage(base64, mediaType);
    const res = await fetch("https://fal.run/fal-ai/birefnet", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageUrl,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048",
        refine_foreground: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
    if (!url) return null;
    const png = await fetch(url);
    if (!png.ok) return null;
    const buf = Buffer.from(await png.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
