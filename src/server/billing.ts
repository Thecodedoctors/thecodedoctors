"use server";

import { db, clients } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import {
  getStripe,
  priceIdFor,
  isStripeConfigured,
  planFromPriceId,
  type BillingInterval,
} from "@/lib/stripe";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * Patient-side billing helpers.
 *
 * Subscriptions: a client has at most ONE subscription at a time. The
 * subscribe action blocks if an active sub already exists; switching
 * tiers goes through `upgradeSubscriptionForCurrentUser` which mutates
 * the existing sub via the Stripe API (so the customer is never billed
 * twice for overlapping plans).
 *
 * Cards: listed and set-as-default on this site. New cards are added
 * via Stripe Checkout in setup-mode (a brief redirect to Stripe-hosted
 * card collection so we don't pull PCI scope onto our worker), then
 * Stripe redirects back here.
 */

export type PlanKey = "general" | "premium";

const PLAN_RANK: Record<PlanKey, number> = { general: 1, premium: 2 };

export type BillingState = {
  configured: boolean;
  plan: string;
  status: string;
  /** Derived from the active Stripe Price ID — `null` if the client has
   *  no subscription yet (Checkup-only or first-time visitor). */
  interval: BillingInterval | null;
  trialEndsAt: Date | null;
  /** Pre-computed on the server so the page render stays pure. */
  trialPhase: "none" | "active" | "ended";
  hasSubscription: boolean;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** Cents per month from the live Stripe subscription, falling back to
   *  the manually-set client.mrr_cents if no subscription yet. */
  mrrCents: number;
};

export async function getBillingStateForCurrentUser(): Promise<BillingState> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const trialEndsAt = client.trialEndsAt ? new Date(client.trialEndsAt) : null;
  let trialPhase: BillingState["trialPhase"] = "none";
  if (trialEndsAt) {
    trialPhase = trialEndsAt.getTime() > Date.now() ? "active" : "ended";
  }

  const interval = client.stripeSubscriptionId
    ? planFromPriceId(client.stripePriceId).interval
    : null;

  return {
    configured: isStripeConfigured(),
    plan: client.plan,
    status: client.status,
    interval,
    trialEndsAt,
    trialPhase,
    hasSubscription: Boolean(client.stripeSubscriptionId),
    subscriptionId: client.stripeSubscriptionId,
    currentPeriodEnd: client.currentPeriodEnd
      ? new Date(client.currentPeriodEnd)
      : null,
    cancelAtPeriodEnd: client.cancelAtPeriodEnd,
    mrrCents: client.mrrCents,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Subscribe / upgrade
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Form action — kicks off Stripe Checkout for a *first* subscription.
 * If the client already has an active subscription, redirects back with
 * an error banner; subsequent tier changes go through
 * `upgradeSubscriptionForCurrentUser` instead so we never double-bill.
 */
export async function startCheckoutForCurrentUser(
  formData: FormData
): Promise<void> {
  const session = await requireUser();
  const planRaw = String(formData.get("plan") ?? "general");
  const plan: PlanKey = planRaw === "premium" ? "premium" : "general";

  const intervalRaw = String(formData.get("interval") ?? "monthly");
  const interval: BillingInterval =
    intervalRaw === "yearly" ? "yearly" : "monthly";

  const stripe = getStripe();
  const priceId = priceIdFor(plan, interval);
  if (!stripe || !priceId) {
    throw new Error("Stripe is not configured.");
  }

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  // Hard guard: if the client already has a subscription, refuse to
  // start a second one. The UI shouldn't expose this path either, but a
  // determined user (or a stale tab) shouldn't be able to double-pay.
  if (client.stripeSubscriptionId) {
    redirect("/dashboard/billing?checkout=already-subscribed");
  }

  // Reuse the existing Stripe customer if we already created one for this
  // client; otherwise create a new one tied to our internal client_id.
  let customerId = client.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: client.name,
      metadata: { clientId: client.id, userId: session.user.id },
    });
    customerId = customer.id;
    await db()
      .update(clients)
      .set({ stripeCustomerId: customerId })
      .where(eq(clients.id, client.id));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${site.url}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site.url}/dashboard/billing?checkout=canceled`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: { clientId: client.id, plan, interval },
    },
    metadata: { clientId: client.id, plan, interval },
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.checkout_started",
    targetType: "client",
    targetId: client.id,
    after: { plan, interval, sessionId: checkoutSession.id },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe didn't return a checkout URL.");
  }
  redirect(checkoutSession.url);
}

/**
 * Form action — switch the existing subscription to a higher tier. We
 * update the subscription's price via the Stripe API (with prorations
 * so the customer is credited for unused time on the old plan and
 * charged the difference) instead of creating a second subscription.
 *
 * Refuses to "upgrade" to the same or a lower plan; the UI already
 * hides those cases but server-side guards live closest to the money.
 */
export async function upgradeSubscriptionForCurrentUser(
  formData: FormData
): Promise<void> {
  const session = await requireUser();
  const planRaw = String(formData.get("plan") ?? "");
  if (planRaw !== "general" && planRaw !== "premium") {
    redirect("/dashboard/billing?upgrade=invalid");
  }
  const plan: PlanKey = planRaw;

  const intervalRaw = String(formData.get("interval") ?? "monthly");
  const interval: BillingInterval =
    intervalRaw === "yearly" ? "yearly" : "monthly";

  const stripe = getStripe();
  const newPriceId = priceIdFor(plan, interval);
  if (!stripe || !newPriceId) {
    throw new Error("Stripe is not configured.");
  }

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  if (!client.stripeSubscriptionId) {
    // Nothing to upgrade from — fall through to the regular subscribe path.
    redirect("/dashboard/billing?upgrade=no-subscription");
  }

  // Refuse downgrades; the Stripe portal handles those. Same-tier
  // changes are allowed when it's a billing-cadence switch (monthly
  // ↔ yearly) but we still block no-op same-price-id changes below
  // after we've fetched the live subscription.
  const currentPlan = client.plan as PlanKey | string;
  const currentRank = PLAN_RANK[currentPlan as PlanKey] ?? 0;
  const targetRank = PLAN_RANK[plan];
  if (targetRank < currentRank) {
    redirect("/dashboard/billing?upgrade=not-higher");
  }

  // Pull the existing subscription so we know which item to swap.
  const subscription = await stripe.subscriptions.retrieve(
    client.stripeSubscriptionId
  );
  const currentItemId = subscription.items.data[0]?.id;
  const currentPriceId = subscription.items.data[0]?.price?.id ?? null;
  if (!currentItemId) {
    throw new Error("Existing subscription has no line items.");
  }
  // Block no-op changes (same plan + same interval). Switching cadence
  // at the same tier is allowed and falls through to update().
  if (currentPriceId === newPriceId) {
    redirect("/dashboard/billing?upgrade=not-higher");
  }

  const updated = await stripe.subscriptions.update(
    client.stripeSubscriptionId,
    {
      items: [{ id: currentItemId, price: newPriceId }],
      // Charge the prorated difference on the next invoice line cycle
      // so the customer pays the delta, not a full second month.
      proration_behavior: "create_prorations",
      metadata: { clientId: client.id, plan, interval },
    }
  );

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.upgraded",
    targetType: "client",
    targetId: client.id,
    before: { plan: currentPlan },
    after: { plan, interval, subscriptionId: updated.id },
  });

  // The webhook (`customer.subscription.updated`) is the source of truth
  // for `client.plan` and `mrrCents`; revalidate so the page re-fetches
  // once it lands.
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  redirect("/dashboard/billing?upgrade=success");
}

/**
 * Form action — opens the Stripe Customer Portal. Kept as a fallback
 * for things we don't surface on-site (cancel, invoices, tax IDs, etc).
 */
export async function openCustomerPortalForCurrentUser(): Promise<void> {
  const session = await requireUser();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.stripeCustomerId) {
    redirect("/dashboard/billing?portal=no-customer");
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: client.stripeCustomerId,
    return_url: `${site.url}/dashboard/billing`,
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.portal_opened",
    targetType: "client",
    targetId: client.id,
  });

  redirect(portal.url);
}

/* ──────────────────────────────────────────────────────────────────────────
   Cards
   ──────────────────────────────────────────────────────────────────────── */

export type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

/** List the customer's saved cards along with which one is default. */
export async function listPaymentMethodsForCurrentUser(): Promise<SavedCard[]> {
  const session = await requireUser();
  const stripe = getStripe();
  if (!stripe) return [];

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.stripeCustomerId) return [];

  const [methods, customer] = await Promise.all([
    stripe.paymentMethods.list({
      customer: client.stripeCustomerId,
      type: "card",
      limit: 20,
    }),
    stripe.customers.retrieve(client.stripeCustomerId),
  ]);

  const defaultPmId =
    customer && !customer.deleted
      ? typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null
      : null;

  return methods.data
    .filter((m) => m.card)
    .map((m) => ({
      id: m.id,
      brand: m.card!.brand,
      last4: m.card!.last4,
      expMonth: m.card!.exp_month,
      expYear: m.card!.exp_year,
      isDefault: m.id === defaultPmId,
    }));
}

/**
 * Form action — kicks off Stripe Checkout in `setup` mode. The customer
 * adds a card on Stripe-hosted UI (so PCI scope stays off our worker)
 * and Stripe redirects back here. We do NOT auto-set the new card as
 * default — they pick from the list afterwards. (If they want to set
 * it as default immediately, they can click "Set default" on the new
 * card row.)
 */
export async function startAddCardCheckoutForCurrentUser(): Promise<void> {
  const session = await requireUser();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  // Lazily create the Stripe customer if missing — mirrors subscribe path.
  let customerId = client.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: client.name,
      metadata: { clientId: client.id, userId: session.user.id },
    });
    customerId = customer.id;
    await db()
      .update(clients)
      .set({ stripeCustomerId: customerId })
      .where(eq(clients.id, client.id));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: customerId,
    success_url: `${site.url}/dashboard/billing?card=added`,
    cancel_url: `${site.url}/dashboard/billing?card=canceled`,
    payment_method_types: ["card"],
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.add_card_started",
    targetType: "client",
    targetId: client.id,
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe didn't return a checkout URL.");
  }
  redirect(checkoutSession.url);
}

/**
 * Form action — set one of the customer's saved cards as the default
 * payment method for invoices. Validates the payment method belongs to
 * this customer before flipping the pointer.
 */
export async function setDefaultPaymentMethodForCurrentUser(
  formData: FormData
): Promise<void> {
  const session = await requireUser();
  const paymentMethodId = String(formData.get("paymentMethodId") ?? "");
  if (!paymentMethodId) {
    redirect("/dashboard/billing?card=invalid");
  }

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.stripeCustomerId) {
    redirect("/dashboard/billing?card=no-customer");
  }

  // Authorization: confirm the payment method actually belongs to this
  // customer. Without this, a determined user could pass another
  // customer's payment_method id.
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== client.stripeCustomerId) {
    redirect("/dashboard/billing?card=forbidden");
  }

  await stripe.customers.update(client.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.default_card_changed",
    targetType: "client",
    targetId: client.id,
    after: { paymentMethodId },
  });

  revalidatePath("/dashboard/billing");
  redirect("/dashboard/billing?card=default-set");
}
