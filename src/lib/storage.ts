import { put } from "@vercel/blob";
import { newId } from "./db";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ImageMediaType = keyof typeof MIME_EXT;

export function isSupportedImage(mediaType: string): mediaType is ImageMediaType {
  return mediaType in MIME_EXT;
}

/** Enregistre une image base64 sur Vercel Blob et retourne son URL publique. */
export async function saveImage(base64: string, mediaType: string): Promise<string> {
  if (!isSupportedImage(mediaType)) {
    throw new Error(`Format d'image non supporté : ${mediaType}`);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Stockage des images non configuré — créez un store Blob sur Vercel (Storage → Create → Blob) pour injecter BLOB_READ_WRITE_TOKEN.",
    );
  }
  const filename = `uploads/${newId()}.${MIME_EXT[mediaType]}`;
  const { url } = await put(filename, Buffer.from(base64, "base64"), {
    access: "public",
    contentType: mediaType,
  });
  return url;
}

/** Extrait { base64, mediaType } d'une data URL `data:image/...;base64,...` */
export function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Image invalide");
  return { mediaType: match[1], base64: match[2] };
}

/** Devine le vrai type MIME à partir des octets (les en-têtes HTTP mentent parfois). */
function sniffMime(b: Buffer): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 4 && b.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

/** Relit une image stockée (URL Blob publique) en base64 pour l'API Claude / fal.ai. */
export async function readUpload(
  url: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Le type réel des octets prime sur l'en-tête (sinon Claude rejette l'image)
    const mediaType = sniffMime(buf) ?? res.headers.get("content-type") ?? "image/jpeg";
    return { base64: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}
