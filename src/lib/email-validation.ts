/**
 * Email plausibility checks for the signup form. Two layers:
 *
 *   1. Disposable-domain blocklist — small static list of the most
 *      common throwaway email services. Catches deliberate fake
 *      signups without dragging in a 5,000-entry dependency.
 *   2. MX record check — DNS lookup via Cloudflare's DoH endpoint
 *      confirms the domain actually accepts mail. Catches typos
 *      (`gmial.com`, `outlook.con`) before we waste a verification
 *      email on them.
 *
 * Both are cheap and run at signup form submit. Real verification
 * (proof of inbox ownership) happens post-payment via the 6-digit code
 * sent to the address.
 */

const DISPOSABLE_DOMAINS = new Set([
  // Top throwaway services as of 2026
  "10minutemail.com",
  "20minutemail.com",
  "anonbox.net",
  "burnermail.io",
  "discard.email",
  "dispostable.com",
  "easytrashmail.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.org",
  "inboxbear.com",
  "mailinator.com",
  "mailinator.net",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "moakt.cc",
  "mvrht.com",
  "nada.email",
  "nwldx.com",
  "pokemail.net",
  "sharklasers.com",
  "spam4.me",
  "spamgourmet.com",
  "spamspot.com",
  "tempail.com",
  "tempinbox.com",
  "tempmail.com",
  "tempmail.dev",
  "tempmail.io",
  "tempmail.org",
  "tempmail.plus",
  "tempr.email",
  "throwaway.email",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "trbvm.com",
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  // Synthetic — for our own automated tests + seeded data
  "thecodedoctors.test",
]);

export type EmailCheckResult =
  | { ok: true }
  | {
      ok: false;
      reason: "syntax" | "disposable" | "no-mx" | "mx-lookup-failed";
      message: string;
    };

const EMAIL_RE = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;

/**
 * Server-side syntactic + deliverability check. Run at form submit
 * BEFORE creating any pending_signup row or charging a card. Returns
 * `{ ok: true }` for plausible addresses; otherwise a tagged error
 * with a user-readable message.
 *
 * Note: the MX check fails OPEN on lookup error (DNS server unreachable,
 * timeout, etc.). We'd rather let an iffy address through than block
 * legitimate signups when our infrastructure has a hiccup.
 */
export async function validateEmailDeliverability(
  rawEmail: string
): Promise<EmailCheckResult> {
  const email = rawEmail.trim().toLowerCase();
  const m = EMAIL_RE.exec(email);
  if (!m) {
    return {
      ok: false,
      reason: "syntax",
      message: "That doesn't look like a valid email address.",
    };
  }
  const domain = m[1];

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ok: false,
      reason: "disposable",
      message:
        "Please use a real email address — disposable inboxes can't receive your invoices.",
    };
  }

  // DNS-over-HTTPS lookup for MX records.
  let res: Response;
  try {
    res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      {
        headers: { Accept: "application/dns-json" },
        signal: AbortSignal.timeout(3000),
      }
    );
  } catch {
    // Network blip — fail open. Better to accept a maybe-bad email than
    // reject a legitimate signup because our DNS lookup timed out.
    return { ok: true };
  }

  if (!res.ok) return { ok: true };

  let data: { Answer?: Array<{ type: number; data?: string }> };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: true };
  }

  // type 15 = MX record. If the domain has at least one valid MX record
  // it accepts mail (or its DNS operator says it does).
  const mxRecords = (data.Answer ?? []).filter((a) => a.type === 15);
  if (mxRecords.length === 0) {
    return {
      ok: false,
      reason: "no-mx",
      message:
        "We couldn't find a mail server for that domain. Double-check the spelling — looks like a typo.",
    };
  }

  return { ok: true };
}
