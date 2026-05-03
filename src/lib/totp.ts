/**
 * RFC 6238 TOTP (HMAC-SHA1, 30s window, 6 digits) implemented on top of
 * Web Crypto so it runs identically in Node and on Cloudflare Workers
 * — no native deps. Standards-compliant: any authenticator app that
 * supports otpauth:// URIs (Google Authenticator, Authy, 1Password,
 * iCloud Passwords, …) will work.
 *
 * Verification accepts the current 30s window plus ±1 to tolerate
 * small clock drift (typical recommendation in the RFC).
 */

import { site } from "@/lib/site";

const PERIOD_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;

/** Generate a fresh 20-byte (160-bit) random secret encoded as base32
 *  (the format authenticator apps expect inside the otpauth URI). */
export function generateTotpSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encode(bytes);
}

/**
 * Build the otpauth:// URI an authenticator app scans from a QR code.
 * The label is shown inside the app — `<issuer>:<account>`. We use the
 * brand short name as issuer and the user's email as account.
 */
export function buildOtpAuthUri({
  secret,
  email,
}: {
  secret: string;
  email: string;
}): string {
  const issuer = encodeURIComponent(site.shortName);
  const account = encodeURIComponent(email);
  const params = new URLSearchParams({
    secret,
    issuer: site.shortName,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${issuer}:${account}?${params.toString()}`;
}

/** Compute the current TOTP for a given secret. Mostly useful for the
 *  setup-time "verify the user got the secret" check. */
export async function totpAt(secret: string, atMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/**
 * Verify a 6-digit code against the current secret, accepting the
 * current window ±1 to absorb clock drift. Returns true on first match.
 */
export async function verifyTotp(
  secret: string,
  code: string,
  atMs: number = Date.now()
): Promise<boolean> {
  const cleaned = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleaned)) return false;
  const t = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  const key = base32Decode(secret);
  for (let drift = -WINDOW; drift <= WINDOW; drift++) {
    const expected = await hotp(key, t + drift);
    if (timingSafeEqual(expected, cleaned)) return true;
  }
  return false;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internals
   ──────────────────────────────────────────────────────────────────────── */

async function hotp(key: Uint8Array, counter: number): Promise<string> {
  // Counter is a big-endian uint64.
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // JS bitwise ops are 32-bit; counter is comfortably below 2^53 so we
  // split into high/low 32-bit halves.
  const hi = Math.floor(counter / 0x100000000);
  const lo = counter >>> 0;
  view.setUint32(0, hi, false);
  view.setUint32(4, lo, false);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));

  // Dynamic truncation per RFC 4226 §5.3.
  const offset = sig[sig.length - 1] & 0x0f;
  const codeInt =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);

  const mod = 10 ** DIGITS;
  return String(codeInt % mod).padStart(DIGITS, "0");
}

/* ──────────────────────────────────────────────────────────────────────────
   Base32 — RFC 4648 alphabet, no padding (canonical for otpauth URIs).
   ──────────────────────────────────────────────────────────────────────── */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
