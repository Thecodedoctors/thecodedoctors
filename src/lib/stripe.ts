import Stripe from "stripe";

/**
 * Singleton Stripe client. Constructed lazily so a missing
 * STRIPE_SECRET_KEY in dev / preview doesn't crash module evaluation —
 * callers should null-check before use.
 */
let _stripe: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    _stripe = null;
    return null;
  }
  // Pin the API version so behavior doesn't drift when Stripe rolls
  // breaking changes server-side. Update intentionally with testing.
  //
  // `httpClient: Stripe.createFetchHttpClient()` is REQUIRED on Cloudflare
  // Workers — the SDK defaults to Node's `http` module which doesn't
  // exist on Workers. Without this, every Stripe API call hangs or
  // throws an opaque error and server actions die silently.
  _stripe = new Stripe(key, {
    apiVersion: "2026-04-22.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });
  return _stripe;
}

export type Plan = "general" | "premium";
export type BillingInterval = "monthly" | "yearly";

/**
 * Resolve the Stripe Price ID for a given plan + billing interval.
 * Yearly variants get a 15% discount baked into the Price object on
 * Stripe's side — this function just routes to the right env var.
 *
 * Env vars expected:
 *   STRIPE_PRICE_GENERAL          — General Care, monthly
 *   STRIPE_PRICE_GENERAL_YEARLY   — General Care, yearly (15% off)
 *   STRIPE_PRICE_PREMIUM          — Premium Care, monthly
 *   STRIPE_PRICE_PREMIUM_YEARLY   — Premium Care, yearly (15% off)
 */
export function priceIdFor(
  plan: Plan,
  interval: BillingInterval = "monthly"
): string | null {
  if (plan === "premium") {
    return interval === "yearly"
      ? process.env.STRIPE_PRICE_PREMIUM_YEARLY ?? null
      : process.env.STRIPE_PRICE_PREMIUM ?? null;
  }
  return interval === "yearly"
    ? process.env.STRIPE_PRICE_GENERAL_YEARLY ?? null
    : process.env.STRIPE_PRICE_GENERAL ?? null;
}

/** One-time Checkup product. Lives in Stripe as a regular Price on a
 *  one-time product (not recurring). Sold via Checkout in `payment` mode. */
export function priceIdForCheckup(): string | null {
  return process.env.STRIPE_PRICE_CHECKUP ?? null;
}

/**
 * True when subscription billing is fully wired (monthly variants of
 * both plans). Yearly + Checkup are optional — their absence shouldn't
 * blank the billing UI.
 */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_GENERAL &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}

/** Reverse-lookup: which plan + interval does a given Stripe Price ID
 *  represent? Used by the webhook to update `client.plan` after a
 *  subscription change. Falls back to ("general", "monthly") for
 *  unknown IDs so webhook handling doesn't crash on legacy data. */
export function planFromPriceId(
  priceId: string | null | undefined
): { plan: Plan; interval: BillingInterval } {
  if (!priceId) return { plan: "general", interval: "monthly" };
  if (priceId === process.env.STRIPE_PRICE_PREMIUM_YEARLY) {
    return { plan: "premium", interval: "yearly" };
  }
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) {
    return { plan: "premium", interval: "monthly" };
  }
  if (priceId === process.env.STRIPE_PRICE_GENERAL_YEARLY) {
    return { plan: "general", interval: "yearly" };
  }
  return { plan: "general", interval: "monthly" };
}
