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

/** Relit une image stockée (URL Blob publique) en base64 pour l'API Claude / fal.ai. */
export async function readUpload(
  url: string,
): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mediaType = res.headers.get("content-type") ?? "image/jpeg";
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { base64, mediaType };
  } catch {
    return null;
  }
}
