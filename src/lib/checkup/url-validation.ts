import { promises as dns } from "node:dns";
import net from "node:net";

const MAX_URL_LENGTH = 2048;
const RESERVED_HOSTNAMES = new Set([
  "localhost",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
  "ip6-localnet",
  "metadata.google.internal",
]);
const FORBIDDEN_TLDS = ["local", "internal", "lan", "intranet", "private", "corp", "home", "test"];

export type ValidatedUrl = {
  url: URL;
  resolvedIps: string[];
};

export class CheckupValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CheckupValidationError";
  }
}

/**
 * Normalize and validate a user-submitted URL with SSRF protection.
 * - Forces http or https scheme (defaulting to https when missing)
 * - Rejects reserved hostnames and forbidden TLDs
 * - Resolves DNS and rejects any private / loopback / link-local IP
 *
 * Throws {@link CheckupValidationError} with a code on rejection.
 */
export async function validateAndResolve(input: string): Promise<ValidatedUrl> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new CheckupValidationError("empty", "Please enter a URL.");
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new CheckupValidationError("too-long", "URL is too long.");
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new CheckupValidationError("invalid", "That doesn't look like a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new CheckupValidationError(
      "scheme",
      "Only http:// and https:// URLs are allowed."
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname) {
    throw new CheckupValidationError("invalid", "URL is missing a hostname.");
  }

  if (RESERVED_HOSTNAMES.has(hostname)) {
    throw new CheckupValidationError("private", "That hostname is reserved.");
  }

  const tld = hostname.split(".").pop() ?? "";
  if (FORBIDDEN_TLDS.includes(tld)) {
    throw new CheckupValidationError("private", "Internal/private TLDs are not scannable.");
  }

  // Reject raw IP literals — we want public hostnames only.
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new CheckupValidationError("private", "Private IP addresses are not scannable.");
    }
    // Allow public IP literals through (rare but legitimate).
    return { url, resolvedIps: [hostname] };
  }

  // DNS lookup — must succeed and return only public IPs.
  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new CheckupValidationError("dns", "We couldn't resolve that hostname.");
  }

  if (addresses.length === 0) {
    throw new CheckupValidationError("dns", "We couldn't resolve that hostname.");
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new CheckupValidationError(
        "private",
        "That hostname resolves to a private network address."
      );
    }
  }

  return { url, resolvedIps: addresses.map((a) => a.address) };
}

/**
 * Returns true if the IP is in any non-globally-routable range.
 * Covers: loopback, link-local, private, multicast, reserved, IPv4-mapped IPv6.
 */
export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true; // unknown — treat as private
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  // 0.0.0.0/8 — current network
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 100.64.0.0/10 — CGNAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 169.254.0.0/16 — link-local (incl AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24, 192.0.2.0/24 — IETF protocol assignments / TEST-NET
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 — benchmarking
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24, 203.0.113.0/24 — TEST-NET-2/3
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  // 224.0.0.0/4 — multicast
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 — reserved
  if (a >= 240) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // ::1 — loopback
  if (lower === "::1") return true;
  // :: — unspecified
  if (lower === "::") return true;
  // fc00::/7 — unique local
  if (/^f[cd][0-9a-f]{2}:/i.test(lower)) return true;
  // fe80::/10 — link-local
  if (/^fe[89ab][0-9a-f]:/i.test(lower)) return true;
  // ff00::/8 — multicast
  if (/^ff[0-9a-f]{2}:/i.test(lower)) return true;
  // ::ffff:0:0/96 — IPv4-mapped — extract embedded v4 and check
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4MappedMatch) {
    return isPrivateIpv4(v4MappedMatch[1]);
  }
  return false;
}
