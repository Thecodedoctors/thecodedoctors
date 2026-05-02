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
  _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

export function priceIdFor(plan: "general" | "premium"): string | null {
  const id =
    plan === "premium"
      ? process.env.STRIPE_PRICE_PREMIUM
      : process.env.STRIPE_PRICE_GENERAL;
  return id ?? null;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_GENERAL &&
      process.env.STRIPE_PRICE_PREMIUM
  );
}
