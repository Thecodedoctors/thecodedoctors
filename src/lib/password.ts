/**
 * PBKDF2-SHA256 password hashing using Web Crypto — works in both Node and
 * Cloudflare Workers without any native deps.
 *
 * Stored format:  pbkdf2$<iterations>$<salt-base64>$<hash-base64>
 *
 * This module is interim. We're on Credentials auth temporarily; magic-link
 * (Resend) is the production target. See memory note
 * `project_auth_credentials_interim.md`.
 */

// OWASP-recommended minimum for PBKDF2-HMAC-SHA256 (2023+). Old hashes
// stored at a lower count still verify — `verifyPassword` reads the
// iteration count out of the stored string, so this only affects newly
// created/changed passwords. They transparently upgrade on next set.
const ITERATIONS = 600_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const derived = await derive(password, salt, ITERATIONS, KEY_BYTES);
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(derived)}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iter = parseInt(parts[1], 10);
  if (!Number.isFinite(iter) || iter < 1000) return false;
  const salt = b64d(parts[2]);
  const expected = b64d(parts[3]);
  const derived = await derive(password, salt, iter, expected.length);
  return timingSafeEqual(derived, expected);
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyBytes: number
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    keyBytes * 8
  );
  return new Uint8Array(bits);
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64d(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
