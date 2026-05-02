"use server";

import { db, clients } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import { getStripe, priceIdFor, isStripeConfigured } from "@/lib/stripe";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * Patient-side billing helpers.
 *
 * Phase 1: trial→paid conversion via the dashboard. Patients on a free
 * trial click "Subscribe" → Stripe Checkout → webhook flips status to
 * active. Paid patients get a "Manage payment method" button that opens
 * the Stripe Customer Portal.
 *
 * Phase 2 (later): rewire /start signups to go through Checkout instead
 * of creating active clients straight away.
 */

export type BillingState = {
  configured: boolean;
  plan: string;
  status: string;
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

  return {
    configured: isStripeConfigured(),
    plan: client.plan,
    status: client.status,
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

/**
 * Form action — kicks off Stripe Checkout for the patient's current
 * client. Either creates a new Stripe customer + subscription, or
 * resumes an existing checkout if one is already in flight.
 *
 * The form passes plan = "general" | "premium". On success, Stripe
 * redirects to /dashboard/billing?checkout=success. On cancel, back to
 * /dashboard/billing?checkout=canceled.
 */
export async function startCheckoutForCurrentUser(
  formData: FormData
): Promise<void> {
  const session = await requireUser();
  const planRaw = String(formData.get("plan") ?? "general");
  const plan = planRaw === "premium" ? "premium" : "general";

  const stripe = getStripe();
  const priceId = priceIdFor(plan);
  if (!stripe || !priceId) {
    throw new Error("Stripe is not configured.");
  }

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

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
      metadata: { clientId: client.id, plan },
    },
    metadata: { clientId: client.id, plan },
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.checkout_started",
    targetType: "client",
    targetId: client.id,
    after: { plan, sessionId: checkoutSession.id },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe didn't return a checkout URL.");
  }
  redirect(checkoutSession.url);
}

/**
 * Form action — opens the Stripe Customer Portal for the current
 * client. The portal handles updating cards, viewing invoices,
 * canceling, etc. Stripe's hosted UI; we just create a session and
 * redirect.
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
