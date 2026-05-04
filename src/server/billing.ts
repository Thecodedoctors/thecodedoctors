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
import { portalActionRedirect } from "@/lib/portal-redirect";

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
    redirect(portalActionRedirect("/dashboard/billing?checkout=already-subscribed"));
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

  // Checkup → Care credit: if this client originally bought the $599
  // Checkup and is now upgrading to a recurring plan, apply the
  // promised $599 credit to their Stripe customer balance. Stripe
  // automatically deducts this from the next invoice(s) — so a General
  // Care month-1 invoice ($299) ends up at $0 due, with $300 carrying
  // forward to month 2.
  //
  // Idempotency: only apply if the customer's current balance is >= 0
  // (i.e. no credit already on file), to prevent double-credit if the
  // user retries checkout multiple times.
  if (client.plan === "checkup" && customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && (customer.balance ?? 0) >= 0) {
        await stripe.customers.update(customerId, {
          balance: -59900,
          metadata: {
            ...(customer.metadata ?? {}),
            checkup_credit_applied_at: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.error(
        "[billing.startCheckout] checkup credit application failed (non-fatal)",
        err
      );
    }
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${site.url}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site.url}/dashboard/billing?checkout=canceled`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Apply customer balance to the first invoice automatically — without
    // this Stripe Checkout treats balance as a future-invoice credit
    // only and "due today" stays at full plan price. Setting this also
    // surfaces the credit in Checkout's UI as a discount line.
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
    redirect(portalActionRedirect("/dashboard/billing?upgrade=invalid"));
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
    redirect(portalActionRedirect("/dashboard/billing?upgrade=no-subscription"));
  }

  // Refuse downgrades; the Stripe portal handles those. Same-tier
  // changes are allowed when it's a billing-cadence switch (monthly
  // ↔ yearly) but we still block no-op same-price-id changes below
  // after we've fetched the live subscription.
  const currentPlan = client.plan as PlanKey | string;
  const currentRank = PLAN_RANK[currentPlan as PlanKey] ?? 0;
  const targetRank = PLAN_RANK[plan];
  if (targetRank < currentRank) {
    redirect(portalActionRedirect("/dashboard/billing?upgrade=not-higher"));
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
    redirect(portalActionRedirect("/dashboard/billing?upgrade=not-higher"));
  }
  // Block yearly → monthly cadence "switches" — they're effectively
  // downgrades (less revenue per period, refund-creating prorations
  // with always_invoice). The UI doesn't expose this path, but a
  // crafted form submission could otherwise sneak through.
  const { interval: currentInterval } = planFromPriceId(currentPriceId);
  if (currentInterval === "yearly" && interval === "monthly") {
    redirect(portalActionRedirect("/dashboard/billing?upgrade=not-higher"));
  }

  // Stripe.subscriptions.update can throw for any number of reasons
  // (price archived on the wrong account, currency mismatch, customer
  // delinquent, expired card). Catch those explicitly so the user sees
  // a banner instead of the global Critical error page.
  //
  // proration_behavior: "always_invoice" issues an immediate invoice
  // for the prorated upgrade amount instead of deferring it to the next
  // billing cycle. Without this the customer "upgrades" but isn't
  // charged until next month — which looks like a free upgrade and
  // creates support work down the road.
  let updatedId: string;
  try {
    const updated = await stripe.subscriptions.update(
      client.stripeSubscriptionId,
      {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_behavior: "always_invoice",
        metadata: { clientId: client.id, plan, interval },
      }
    );
    updatedId = updated.id;
  } catch (err) {
    console.error(
      "[billing.upgrade] Stripe subscriptions.update failed",
      { subscriptionId: client.stripeSubscriptionId, plan, interval, newPriceId },
      err
    );
    redirect(portalActionRedirect("/dashboard/billing?upgrade=failed"));
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.upgraded",
    targetType: "client",
    targetId: client.id,
    before: { plan: currentPlan },
    after: { plan, interval, subscriptionId: updatedId },
  });

  // The webhook (`customer.subscription.updated`) is the source of truth
  // for `client.plan` and `mrrCents`; revalidate so the page re-fetches
  // once it lands.
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  redirect(portalActionRedirect("/dashboard/billing?upgrade=success"));
}

/**
 * Form action — converts an active trial into a paid subscription
 * immediately. Stripe ends the trial and charges the card on file for
 * the first billing period. The webhook follows up with the new
 * status / mrrCents / currentPeriodEnd.
 *
 * Idempotent: if the trial already ended (or no subscription exists),
 * redirects with a banner instead of throwing.
 */
export async function endTrialNowForCurrentUser(): Promise<void> {
  const session = await requireUser();
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  if (!client.stripeSubscriptionId) {
    redirect(portalActionRedirect("/dashboard/billing?trial=no-subscription"));
  }
  if (
    !client.trialEndsAt ||
    new Date(client.trialEndsAt).getTime() <= Date.now()
  ) {
    redirect(portalActionRedirect("/dashboard/billing?trial=already-ended"));
  }

  try {
    await stripe.subscriptions.update(client.stripeSubscriptionId, {
      // Setting trial_end to "now" tells Stripe to end the trial
      // immediately, kick off a fresh billing cycle, and charge the
      // card on file. proration_behavior is irrelevant here — there's
      // no prior paid period to prorate against.
      trial_end: "now",
    });
  } catch (err) {
    console.error(
      "[billing.endTrialNow] Stripe subscriptions.update failed",
      { subId: client.stripeSubscriptionId },
      err
    );
    redirect(portalActionRedirect("/dashboard/billing?trial=failed"));
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.trial_converted",
    targetType: "client",
    targetId: client.id,
  });

  // Webhook (`customer.subscription.updated`) is the source of truth
  // for client.trialEndsAt / status / mrrCents — revalidate so the page
  // re-fetches once it lands.
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard");
  redirect(portalActionRedirect("/dashboard/billing?trial=converted"));
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
    redirect(portalActionRedirect("/dashboard/billing?portal=no-customer"));
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

export type ClientInvoice = {
  id: string;
  /** Human-friendly Stripe invoice number (e.g. "ABC-0001"). Falls back
   *  to the invoice id for drafts that haven't been numbered yet. */
  number: string;
  /** When the invoice was issued. */
  date: Date;
  /** Cents in the currency below. */
  amount: number;
  currency: string;
  /** Stripe invoice status. We only surface paid / open / void / uncollectible
   *  in the UI; draft + deleted are filtered out by the list call. */
  status: "paid" | "open" | "void" | "uncollectible" | "draft";
  /** Human description of what the invoice covers (line item descriptions
   *  joined). Empty string when Stripe doesn't return any. */
  summary: string;
  /** Direct PDF download URL hosted by Stripe. Public, single-use-ish. */
  pdfUrl: string | null;
  /** Stripe-hosted invoice viewer URL (paid receipts open here). */
  hostedUrl: string | null;
};

/**
 * List the customer's recent invoices for in-app rendering. Returns at
 * most the last 24 invoices, newest first. Empty array if the customer
 * has no invoices yet (first month not billed, or Stripe not yet linked).
 */
export async function listInvoicesForCurrentUser(): Promise<ClientInvoice[]> {
  const session = await requireUser();
  const stripe = getStripe();
  if (!stripe) return [];

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.stripeCustomerId) return [];

  const invoices = await stripe.invoices.list({
    customer: client.stripeCustomerId,
    limit: 24,
    // Don't surface draft invoices — they're transient and confusing.
    status: undefined,
  });

  return invoices.data
    .filter((inv) => inv.status !== "draft")
    .map((inv) => ({
      id: inv.id ?? "",
      number: inv.number ?? inv.id ?? "",
      date: new Date((inv.created ?? Math.floor(Date.now() / 1000)) * 1000),
      // Always show the invoice's original total — falling back to
      // amount_paid would render voided/uncollectible invoices as $0,
      // which looks like a refund. The status badge separately conveys
      // whether the customer was charged or not.
      amount: inv.total ?? inv.amount_due ?? 0,
      currency: inv.currency ?? "usd",
      status: (inv.status ?? "open") as ClientInvoice["status"],
      summary:
        inv.lines?.data
          ?.map((l) => l.description)
          .filter((d): d is string => Boolean(d))
          .join(" · ") ?? "",
      pdfUrl: inv.invoice_pdf ?? null,
      hostedUrl: inv.hosted_invoice_url ?? null,
    }));
}

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
    redirect(portalActionRedirect("/dashboard/billing?card=invalid"));
  }

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured.");

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.stripeCustomerId) {
    redirect(portalActionRedirect("/dashboard/billing?card=no-customer"));
  }

  // Authorization: confirm the payment method actually belongs to this
  // customer. Without this, a determined user could pass another
  // customer's payment_method id. Wrapped in try/catch so a malformed
  // PM id throws a banner instead of bubbling to the Critical page.
  let pm;
  try {
    pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch (err) {
    console.error(
      "[billing.setDefaultPaymentMethod] retrieve failed",
      { paymentMethodId },
      err
    );
    redirect(portalActionRedirect("/dashboard/billing?card=invalid"));
  }
  if (pm.customer !== client.stripeCustomerId) {
    redirect(portalActionRedirect("/dashboard/billing?card=forbidden"));
  }

  try {
    await stripe.customers.update(client.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (err) {
    console.error(
      "[billing.setDefaultPaymentMethod] customers.update failed",
      { paymentMethodId },
      err
    );
    redirect(portalActionRedirect("/dashboard/billing?card=invalid"));
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "billing.default_card_changed",
    targetType: "client",
    targetId: client.id,
    after: { paymentMethodId },
  });

  revalidatePath("/dashboard/billing");
  redirect(portalActionRedirect("/dashboard/billing?card=default-set"));
}
