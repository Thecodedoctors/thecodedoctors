/**
 * Cloudflare Turnstile server-side verification.
 *
 * Returns { ok: true } when:
 *   - Token is present and validates against Cloudflare's siteverify endpoint
 *   - (NON-production only) Turnstile is not configured — dev convenience
 *
 * In production a missing TURNSTILE_SECRET_KEY FAILS CLOSED: every
 * protected endpoint (scanner, lead, contact, etc.) is denied rather
 * than silently dropping bot protection on a misconfigured deploy.
 *
 * Returns { ok: false, reason } otherwise.
 */
export type TurnstileResult = { ok: true } | { ok: false; reason: string };

export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Misconfigured production deploy — deny, don't silently disable
      // bot protection on every public endpoint.
      console.error(
        "[turnstile] TURNSTILE_SECRET_KEY unset in production — failing closed"
      );
      return { ok: false, reason: "captcha-misconfigured" };
    }
    // Non-production only: pass through for local dev convenience.
    return { ok: true };
  }

  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  let res: Response;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      // Short timeout — we shouldn't make users wait
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return { ok: false, reason: "verify-failed" };
  }

  if (!res.ok) {
    return { ok: false, reason: "verify-status" };
  }

  const data = (await res.json()) as { success?: boolean };
  return data.success ? { ok: true } : { ok: false, reason: "rejected" };
}
