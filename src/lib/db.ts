import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Database } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });
}

export function readDb(): Database {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], garments: [], outfits: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) as Database;
  } catch {
    return { users: [], garments: [], outfits: [] };
  }
}

export function writeDb(db: Database) {
  ensureDir();
  const tmp = DB_FILE + "." + crypto.randomBytes(4).toString("hex");
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function mutateDb<T>(fn: (db: Database) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

export function newId(): string {
  return crypto.randomBytes(10).toString("hex");
}

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
