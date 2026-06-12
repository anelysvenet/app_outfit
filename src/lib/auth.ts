import crypto from "node:crypto";
import { cookies } from "next/headers";
import { readDb } from "./db";
import type { User } from "./types";

const SESSION_COOKIE = "aura_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 jours

// En production (Vercel), AUTH_SECRET DOIT être défini : il garantit des
// sessions valides et stables entre les instances serverless. Le repli n'est
// qu'un dépannage de développement local.
function getSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return "aura-dev-insecure-secret-set-AUTH_SECRET-in-production";
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const payload = `${userId}.${expires}`;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  if (Number(expires) < Date.now()) return null;
  return userId;
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const userId = parseSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const db = await readDb();
  return db.users.find((u) => u.id === userId) ?? null;
}

export function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
