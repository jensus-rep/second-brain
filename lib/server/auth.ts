import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { store } from "./store";
import { accessKeyHash, bearerKey } from "./access-keys";

export type SessionUser = { userId: string; email: string };

const COOKIE = "newhope_session";
const SESSION_SECONDS = 14 * 24 * 60 * 60;
const DEV_USER: SessionUser = { userId: "local_dev", email: "dev@localhost" };
export const MIN_PASSWORD_LENGTH = 12;

const production = () => process.env.NODE_ENV === "production";
// Local dev and browser tests sign in through /api/auth/dev-login, like the former platform mock. Never active in a production build.
export const devAutoLogin = () => process.env.NODE_ENV === "development" && process.env.NEWHOPE_DEV_AUTOLOGIN !== "false";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (production()) throw new Error("SESSION_SECRET muss in Produktion mindestens 32 Zeichen lang sein.");
  return "newhope-local-development-session-secret";
}
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const equal = (a: string, b: string) => {
  const x = createHash("sha256").update(a).digest(), y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
};

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !equal(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; exp?: unknown };
    return typeof data.u === "string" && typeof data.exp === "number" && data.exp > Date.now() / 1000 ? data.u : null;
  } catch { return null; }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = readToken((await cookies()).get(COOKIE)?.value);
  if (!userId) return null;
  if (userId === DEV_USER.userId) return devAutoLogin() ? DEV_USER : null;
  const user = await (await store()).findUserById(userId);
  return user ? { userId: user.id, email: user.email } : null;
}

/**
 * For the data routes (workspace and images): a personal access key as Bearer token, otherwise the session cookie.
 * Creating and revoking keys stays session-only, so a key can never mint further keys.
 */
export async function getApiUser(request: Request): Promise<SessionUser | null> {
  const key = bearerKey(request.headers.get("authorization"));
  if (key === undefined) return getSessionUser();
  if (key === null) return null;
  const db = await store();
  const record = await db.findAccessKey(accessKeyHash(key));
  if (!record) return null;
  let user: SessionUser | null = null;
  if (record.ownerId === DEV_USER.userId) user = devAutoLogin() ? DEV_USER : null;
  else {
    const found = await db.findUserById(record.ownerId);
    user = found ? { userId: found.id, email: found.email } : null;
  }
  if (user && (!record.lastUsedAt || Date.now() - Date.parse(record.lastUsedAt) > 60_000)) {
    await db.touchAccessKey(record.id, new Date().toISOString()).catch(error => console.error("Access key touch failed", error));
  }
  return user;
}

export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;
  const target = encodeURIComponent(safeReturnTo(returnTo));
  redirect((devAutoLogin() ? "/api/auth/dev-login?return_to=" : "/login?return_to=") + target);
}

export const startDevSession = () => startSession(DEV_USER.userId);

export async function startSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString("base64url");
  (await cookies()).set(COOKIE, payload + "." + sign(payload), { httpOnly: true, secure: production(), sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
}

export async function endSession() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, secure: production(), sameSite: "lax", path: "/", maxAge: 0 });
}

const derive = (password: string, salt: Buffer) => new Promise<Buffer>((resolve, reject) =>
  scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return "scrypt$16384$8$1$" + salt.toString("base64url") + "$" + (await derive(password, salt)).toString("base64url");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || n !== "16384" || r !== "8" || p !== "1" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const normalizeEmail = (value: string) => value.trim().toLowerCase();

export function setupTokenMatches(token: string): boolean {
  const expected = process.env.NEWHOPE_SETUP_TOKEN;
  return !!expected && expected.length >= 24 && equal(token, expected);
}

// Slows down password guessing per account and client; resets after a successful login.
const attempts = new Map<string, { failures: number; lockedUntil: number }>();
export function loginLocked(key: string): boolean {
  const entry = attempts.get(key);
  return !!entry && entry.lockedUntil > Date.now();
}
export function recordLogin(key: string, success: boolean) {
  if (success) { attempts.delete(key); return; }
  const entry = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  entry.failures++;
  if (entry.failures >= 5) { entry.lockedUntil = Date.now() + 15 * 60 * 1000; entry.failures = 0; }
  attempts.set(key, entry);
  if (attempts.size > 5000) attempts.clear();
}

/** Rejects cross-site writes. Compares hosts because App Service terminates TLS in front of Node. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try { return !!host && new URL(origin).host === host.split(",")[0].trim(); } catch { return false; }
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local" || url.pathname.startsWith("/login") || url.pathname.startsWith("/api/")) return "/";
    return url.pathname + url.search + url.hash;
  } catch { return "/"; }
}
