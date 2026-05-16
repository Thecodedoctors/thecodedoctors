/**
 * Sanitize a post-login `next` redirect target. Open-redirect guard:
 * only a same-origin absolute path is allowed. Rejects protocol-
 * relative (`//evil.com`), backslash tricks (`/\evil.com`), scheme
 * URLs (these never start with `/`), and CRLF/control chars. Anything
 * suspicious falls back to the dashboard.
 *
 * Plain util (no "use server"/"use client") so the server action and
 * the server component can share one implementation.
 */
export function sanitizeNext(raw: unknown): string {
  const fallback = "/dashboard";
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (raw[0] !== "/") return fallback;
  if (raw[1] === "/" || raw[1] === "\\") return fallback;
  if (
    Array.from(raw).some((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x20 || c === 0x7f;
    })
  ) {
    return fallback;
  }
  return raw;
}
