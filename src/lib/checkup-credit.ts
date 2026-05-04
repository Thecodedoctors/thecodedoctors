import type Stripe from "stripe";

/**
 * Honors the marketing promise: "$599 credit toward your first 2 months
 * of ongoing care" for any patient who upgrades from Checkup-only to a
 * recurring plan.
 *
 * Mechanism: a per-customer Stripe coupon attached to the Checkout
 * session via `discounts: [{ coupon }]`. Coupons (unlike
 * customer.balance) display in Stripe Checkout's UI as a discount line
 * AND reduce the "due today" amount the customer sees — which is what
 * matters for trust ("I see $0 due, I get charged $0").
 *
 * Coupon shape per plan:
 *   - General Care ($299/mo): $299 off × 2 months ($598 total). Patient
 *     pays $0 month 1 + $0 month 2 + $299/mo from month 3.
 *   - Premium Care ($899/mo): $599 off once. Patient pays $300 month 1
 *     + $899/mo from month 2 onward.
 *
 * Idempotency: we store the coupon id on the customer's metadata under
 * `checkup_credit_coupon_id`. On retry checkout we reuse the existing
 * coupon if it's still valid; otherwise create a fresh one.
 *
 * Returns the coupon id to attach to the Checkout session, or undefined
 * if creation failed (caller falls back to no-discount checkout).
 */
export async function ensureCheckupCredit({
  stripe,
  customerId,
  plan,
}: {
  stripe: Stripe;
  customerId: string;
  plan: "general" | "premium";
}): Promise<string | undefined> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return undefined;

  const existingCouponId =
    customer.metadata?.checkup_credit_coupon_id ?? undefined;

  // If we already created a coupon for this customer, try to reuse it.
  // Coupons that have been redeemed (max_redemptions=1) come back with
  // `valid: false` — in that case the credit was already consumed and
  // we don't issue another.
  if (existingCouponId) {
    try {
      const c = await stripe.coupons.retrieve(existingCouponId);
      if (c.valid) return c.id;
      // Already redeemed or expired — don't issue a new one.
      return undefined;
    } catch {
      // Coupon was deleted out from under us; fall through and create a fresh one.
    }
  }

  // Per-customer coupon. The shape varies by plan to match what the
  // marketing promised (see file header).
  const couponParams: Stripe.CouponCreateParams =
    plan === "premium"
      ? {
          amount_off: 59900,
          currency: "usd",
          duration: "once",
          max_redemptions: 1,
          // 30-day expiry on the chance to redeem (overdeliver vs the
          // marketing's same-window promise — generous but bounded).
          redeem_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          name: "Checkup → Care credit ($599)",
        }
      : {
          amount_off: 29900,
          currency: "usd",
          duration: "repeating",
          duration_in_months: 2,
          max_redemptions: 1,
          redeem_by: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          name: "Checkup → Care credit ($598 across 2 months)",
        };

  const coupon = await stripe.coupons.create(couponParams);

  await stripe.customers.update(customerId, {
    metadata: {
      ...(customer.metadata ?? {}),
      checkup_credit_coupon_id: coupon.id,
      checkup_credit_applied_at: new Date().toISOString(),
    },
  });

  return coupon.id;
}
