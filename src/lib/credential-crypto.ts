/**
 * AES-256-GCM symmetric encryption for the credential vault. Runs on
 * Web Crypto so it works identically in Node and on Cloudflare
 * Workers — no native deps.
 *
 * Stored format: `v1:<iv-base64>:<ciphertext-with-tag-base64>`
 *
 * Key handling:
 *   - The 32-byte key lives in `CREDENTIAL_ENCRYPTION_KEY` as standard
 *     base64 (`openssl rand -base64 32`).
 *   - `getKey()` reads it on every call so a missed env var fails loudly
 *     instead of silently encrypting with a default.
 *   - We do NOT cache the key bytes globally — the worker isolate
 *     would expose them in a memory dump otherwise. Web Crypto
 *     `importKey` is fast enough.
 */

const ENCRYPTION_VERSION = "v1";
const IV_BYTES = 12; // GCM standard

export const CURRENT_ENCRYPTION_VERSION = ENCRYPTION_VERSION;

export class MissingEncryptionKeyError extends Error {
  constructor() {
    super(
      "CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with " +
        "`openssl rand -base64 32` and add it to the worker secrets."
    );
    this.name = "MissingEncryptionKeyError";
  }
}

export function isCredentialCryptoConfigured(): boolean {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  return Boolean(raw && raw.length >= 40); // 32 bytes b64 ≈ 44 chars
}

export async function encryptCredentialPayload(
  plaintext: unknown
): Promise<{ encrypted: string; version: string }> {
  const key = await loadKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = new TextEncoder().encode(JSON.stringify(plaintext));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data as BufferSource
  );
  return {
    encrypted: `${ENCRYPTION_VERSION}:${b64(iv)}:${b64(new Uint8Array(cipher))}`,
    version: ENCRYPTION_VERSION,
  };
}

export async function decryptCredentialPayload<T = unknown>(
  stored: string
): Promise<T> {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed credential ciphertext.");
  }
  const [version, ivB64, ctB64] = parts;
  if (version !== ENCRYPTION_VERSION) {
    throw new Error(
      `Unsupported credential encryption version: ${version}.`
    );
  }
  const key = await loadKey();
  const iv = b64Decode(ivB64);
  const ct = b64Decode(ctB64);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ct as BufferSource
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/* ──────────────────────────────────────────────────────────────────────── */

async function loadKey(): Promise<CryptoKey> {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) throw new MissingEncryptionKeyError();
  const bytes = b64Decode(raw);
  if (bytes.length !== 32) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${bytes.length}). ` +
        "Generate a fresh one with `openssl rand -base64 32`."
    );
  }
  return crypto.subtle.importKey(
    "raw",
    bytes as BufferSource,
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
