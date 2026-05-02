/**
 * Best-effort URL normalizer for user-supplied website inputs. Accepts
 * any of:
 *   - "thecodedoctors.com"
 *   - "www.thecodedoctors.com"
 *   - "thecodedoctors.com/path"
 *   - "https://thecodedoctors.com"
 *   - "  HTTP://Thecodedoctors.com/  "  (whitespace, casing, trailing slash)
 *
 * Returns a fully-qualified `https://...` (or `http://...` if explicitly
 * given) URL string when valid, or null when the input doesn't look
 * like a real domain.
 *
 * Used everywhere we accept a website URL from a user — onboarding,
 * site-health editor, admin client edit, etc. — so patients can type
 * "yoursite.com" and have it just work.
 */
export function normalizeWebsiteUrl(input: string): string | null {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return null;

  // Path 1 — already has a scheme. Validate it's http(s).
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      if (!hasDottedHostname(url.hostname)) return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  // Path 2 — no scheme. Prepend https:// and re-parse. Reject inputs
  // that don't have a real-looking hostname (must contain at least one
  // dot, can't be just a path).
  try {
    const url = new URL(`https://${trimmed}`);
    if (!hasDottedHostname(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function hasDottedHostname(hostname: string): boolean {
  if (!hostname) return false;
  // Must include at least one dot and have something on either side of
  // it. Excludes "localhost" — public-facing input only.
  if (!hostname.includes(".")) return false;
  if (hostname.startsWith(".") || hostname.endsWith(".")) return false;
  return true;
}
