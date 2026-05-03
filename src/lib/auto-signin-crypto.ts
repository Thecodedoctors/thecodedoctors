/**
 * Tiny AES-GCM helper used by the /trial → Stripe → /welcome flow to
 * keep the user's plaintext password around just long enough to
 * auto-sign-them-in after Stripe Checkout completes — avoiding the
 * "type your password again" UX that the founder flagged.
 *
 * Encryption key is derived from `AUTH_SECRET` (already required for
 * Auth.js JWT signing) via SHA-256 with a domain separator, so we
 * don't introduce a new env requirement just for this. The encrypted
 * value lives on `pending_signup` for at most 24 hours and gets
 * cleared the moment the user is finalised.
 *
 * This is intentionally separate from `credential-crypto.ts` (which
 * uses its own `CREDENTIAL_ENCRYPTION_KEY` for the credential vault)
 * — different blast radius, different key.
 */

const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12;

export async function encryptAutoSigninPassword(
  plaintext: string
): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource
  );
  return `${ENCRYPTION_VERSION}:${b64(iv)}:${b64(new Uint8Array(cipher))}`;
}

export async function decryptAutoSigninPassword(
  stored: string
): Promise<string | null> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== ENCRYPTION_VERSION) return null;
  try {
    const key = await deriveKey();
    const iv = b64Decode(parts[1]);
    const ct = b64Decode(parts[2]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ct as BufferSource
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────── */

async function deriveKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set; auto-signin can't derive an encryption key."
    );
  }
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${secret}:auto_signin_v1`) as BufferSource
  );
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
