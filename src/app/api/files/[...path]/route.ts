import path from "node:path";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { UPLOADS_DIR } from "@/lib/db";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params;
  const filename = path.basename(segments.join("/"));
  const file = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const body = fs.readFileSync(file);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
