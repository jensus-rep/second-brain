import { createHash, randomBytes } from "node:crypto";

// Personal access keys let local tools read and write the owner's workspace without a browser session.
// Only a SHA-256 hash is stored; the key itself is shown once when it is created.
export const ACCESS_KEY_PATTERN = /^nh_[A-Za-z0-9_-]{43}$/;
export const MAX_ACCESS_KEYS = 10;
export const MAX_ACCESS_KEY_NAME = 60;

export const accessKeyHash = (key: string) => createHash("sha256").update(key).digest("hex");

export function newAccessKey() {
  const key = "nh_" + randomBytes(32).toString("base64url");
  return { key, hash: accessKeyHash(key), hint: key.slice(-4) };
}

/** undefined: no Authorization header (fall back to the session); null: a header that is not a valid key. */
export function bearerKey(header: string | null): string | null | undefined {
  if (header === null) return undefined;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match && ACCESS_KEY_PATTERN.test(match[1]) ? match[1] : null;
}

export function accessKeyName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= MAX_ACCESS_KEY_NAME ? name : null;
}
