import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { Database } from "./types";

const EMPTY_DB: Database = { users: [], garments: [], outfits: [] };

// Vercel Postgres est désormais fourni par l'intégration native Neon, qui
// injecte DATABASE_URL (connexion poolée). On lit aussi POSTGRES_URL en repli
// pour rester compatible avec d'anciens projets.
function connectionString(): string {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      "Base de données non configurée — définissez DATABASE_URL (intégration Neon/Postgres sur Vercel).",
    );
  }
  return url;
}

let _sql: ReturnType<typeof neon> | null = null;
function db() {
  if (!_sql) _sql = neon(connectionString());
  return _sql;
}

// La base est stockée sous forme d'une unique ligne JSONB (clé « db ») dans une
// table clé-valeur. On conserve ainsi exactement la sémantique de l'ancien
// stockage fichier (read-modify-write). Pour de plus gros volumes, ce schéma se
// normalise facilement en tables users / garments / outfits.

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = db()`
      CREATE TABLE IF NOT EXISTS kv_store (
        key text PRIMARY KEY,
        value jsonb NOT NULL
      )
    `.then(() => undefined);
  }
  return schemaReady;
}

export async function readDb(): Promise<Database> {
  await ensureSchema();
  const rows = (await db()`SELECT value FROM kv_store WHERE key = 'db'`) as {
    value: Database;
  }[];
  if (!rows.length) return structuredClone(EMPTY_DB);
  return rows[0].value;
}

export async function writeDb(database: Database): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO kv_store (key, value)
    VALUES ('db', ${JSON.stringify(database)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function mutateDb<T>(fn: (db: Database) => T): Promise<T> {
  const database = await readDb();
  const result = fn(database);
  await writeDb(database);
  return result;
}

export function newId(): string {
  return crypto.randomBytes(10).toString("hex");
}
