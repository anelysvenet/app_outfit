import fs from "node:fs";
import path from "node:path";
import { UPLOADS_DIR, newId } from "./db";

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

/** Enregistre une image base64 et retourne l'URL servie par /api/files. */
export function saveImage(base64: string, mediaType: string): string {
  if (!isSupportedImage(mediaType)) {
    throw new Error(`Format d'image non supporté : ${mediaType}`);
  }
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = `${newId()}.${MIME_EXT[mediaType]}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64, "base64"));
  return `/api/files/${filename}`;
}

/** Extrait { base64, mediaType } d'une data URL `data:image/...;base64,...` */
export function parseDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Image invalide");
  return { mediaType: match[1], base64: match[2] };
}

/** Relit une image uploadée (URL /api/files/xxx) en base64 pour l'API Claude. */
export function readUpload(url: string): { base64: string; mediaType: string } | null {
  const filename = url.split("/").pop();
  if (!filename) return null;
  const safe = path.basename(filename);
  const file = path.join(UPLOADS_DIR, safe);
  if (!fs.existsSync(file)) return null;
  const ext = safe.split(".").pop() ?? "jpg";
  const mediaType =
    Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] ?? "image/jpeg";
  return { base64: fs.readFileSync(file).toString("base64"), mediaType };
}
