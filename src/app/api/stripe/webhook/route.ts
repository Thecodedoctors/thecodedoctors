import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db, clients } from "@/db";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { recordAudit } from "@/server/audit";
import {
  dispatchEvent,
  membersOfClient,
} from "@/server/notifications";
import { finalizePendingSignupBySessionId } from "@/server/onboard-finalize";

/**
 * Stripe webhook — single endpoint that handles every subscription /
 * invoice lifecycle event. Verifies the signature using
 * STRIPE_WEBHOOK_SECRET; all DB writes are side-effects driven from
 * the verified Stripe events (never trust client-supplied payloads).
 *
 * Events we listen for (configured in dashboard.stripe.com → Webhooks):
 *   - checkout.session.completed         → first activation
 *   - customer.subscription.updated      → plan changes, renewals, cancels-pending
 *   - customer.subscription.deleted      → access revoked
 *   - invoice.paid                       → recurring payment succeeded
 *   - invoice.payment_failed             → recurring payment failed
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error("[stripe-webhook] not configured", { stripe: !!stripe, secret: !!secret });
    return new NextResponse("Stripe not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.created":
        await onSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        // Ignore everything we haven't subscribed to. Stripe re-tries
        // 5xx but treats 2xx as accepted, so this is the safe default.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler failed", event.type, err);
    // 500 makes Stripe retry; only return 500 for transient errors.
    // Permanent failures should log but return 200 so we don't pile up
    // retries forever.
    return new NextResponse("Internal error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/* ──────────────────────────────────────────────────────────────────────── */

async function onCheckoutCompleted(s: Stripe.Checkout.Session) {
  // Path A — pending_signup flow: the signup was deferred until this
  // event. Finalize creates the user/client/client_member from the
  // pending row. Idempotent if /welcome already finalized.
  const pendingToken = s.metadata?.pendingSignupToken;
  if (pendingToken) {
    const result = await finalizePendingSignupBySessionId(s.id);
    if (!result.ok) {
      console.error("[stripe-webhook] finalize failed", s.id, result.error);
      return;
    }
    const recipients = await membersOfClient(result.clientId);
    await dispatchEvent({
      recipients,
      eventKey: "billing.activated",
      title: "You're active",
      body: "Card on file, your trial has started. Your doctor will be in touch shortly.",
      href: "/billing",
      targetType: "client",
      targetId: result.clientId,
    });
    return;
  }

  // Path B — legacy / dashboard-driven conversion. An existing client
  // (free-trial or otherwise) just attached a card via the patient hub.
  // metadata.clientId is set by startCheckoutForCurrentUser.
  const clientId = s.metadata?.clientId;
  if (!clientId) {
    console.warn("[stripe-webhook] checkout completed with no clientId or token", s.id);
    return;
  }

  const subscriptionId =
    typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
  const customerId =
    typeof s.customer === "string" ? s.customer : s.customer?.id ?? null;

  await db()
    .update(clients)
    .set({
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: subscriptionId ?? undefined,
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));

  await recordAudit({
    actorUserId: null,
    action: "billing.activated",
    targetType: "client",
    targetId: clientId,
    after: { stripeSubscriptionId: subscriptionId, sessionId: s.id },
  });

  const recipients = await membersOfClient(clientId);
  await dispatchEvent({
    recipients,
    eventKey: "billing.activated",
    title: "You're active",
    body: "Payment received. Your doctor will be in touch shortly.",
    href: "/billing",
    targetType: "client",
    targetId: clientId,
  });
}

async function onSubscriptionChange(sub: Stripe.Subscription) {
  const subType = sub as unknown as {
    items: {
      data: Array<{ price: { id: string; unit_amount: number | null } }>;
    };
    current_period_end: number;
    trial_end: number | null;
    cancel_at_period_end: boolean;
  };
  const item = subType.items.data[0];

  let clientId = sub.metadata?.clientId;
  if (!clientId) {
    // Fall back to lookup by subscription id (already-existing client).
    const existing = await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.stripeSubscriptionId, sub.id))
      .limit(1);
    if (existing.length === 0) {
      console.warn(
        "[stripe-webhook] subscription update with no clientId match",
        sub.id
      );
      return;
    }
    clientId = existing[0].id;
  }
  await applySubscriptionUpdate(clientId, sub, item, subType);
}

async function applySubscriptionUpdate(
  clientId: string,
  sub: Stripe.Subscription,
  item: { price: { id: string; unit_amount: number | null } } | undefined,
  subType: {
    current_period_end: number;
    trial_end: number | null;
    cancel_at_period_end: boolean;
  }
) {
  const periodEnd = new Date(subType.current_period_end * 1000);
  const priceId = item?.price.id ?? null;
  const monthlyCents = item?.price.unit_amount ?? 0;
  const isActive = sub.status === "active" || sub.status === "trialing";

  // Trial state syncs from Stripe — trial_end is null on paid plans.
  const trialEndsAt = subType.trial_end
    ? new Date(subType.trial_end * 1000)
    : null;

  // Map price ID back to our plan label so /admin and the patient hub
  // show the right tier without us having to maintain a manual mirror.
  let planUpdate: { plan: "general" | "premium" } | Record<string, never> = {};
  if (priceId === process.env.STRIPE_PRICE_PREMIUM) {
    planUpdate = { plan: "premium" };
  } else if (priceId === process.env.STRIPE_PRICE_GENERAL) {
    planUpdate = { plan: "general" };
  }

  await db()
    .update(clients)
    .set({
      ...planUpdate,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      currentPeriodEnd: periodEnd,
      trialEndsAt,
      cancelAtPeriodEnd: subType.cancel_at_period_end,
      mrrCents: isActive && !subType.cancel_at_period_end ? monthlyCents : 0,
      status: isActive ? "active" : "lead",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));

  await recordAudit({
    actorUserId: null,
    action: "billing.subscription_updated",
    targetType: "client",
    targetId: clientId,
    after: {
      stripeStatus: sub.status,
      cancelAtPeriodEnd: subType.cancel_at_period_end,
      priceId,
      trialing: Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now()),
    },
  });
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const clientId = sub.metadata?.clientId;
  const targetId = clientId
    ? clientId
    : (
        await db()
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.stripeSubscriptionId, sub.id))
          .limit(1)
      )[0]?.id;
  if (!targetId) return;

  await db()
    .update(clients)
    .set({
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      mrrCents: 0,
      status: "discharged",
      updatedAt: new Date(),
    })
    .where(eq(clients.id, targetId));

  await recordAudit({
    actorUserId: null,
    action: "billing.subscription_deleted",
    targetType: "client",
    targetId: targetId,
    before: { stripeSubscriptionId: sub.id },
  });
}

async function onInvoicePaid(inv: Stripe.Invoice) {
  // Just log. Status keeps current_period_end advanced via the
  // subscription.updated event Stripe also sends.
  console.log("[stripe-webhook] invoice paid", inv.id, inv.amount_paid);
}

async function onInvoiceFailed(inv: Stripe.Invoice) {
  const subscriptionId =
    (inv as unknown as { subscription?: string | { id: string } | null })
      .subscription;
  const subId =
    typeof subscriptionId === "string"
      ? subscriptionId
      : subscriptionId?.id ?? null;
  if (!subId) return;
  const clientRow = (
    await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.stripeSubscriptionId, subId))
      .limit(1)
  )[0];
  if (!clientRow) return;

  await recordAudit({
    actorUserId: null,
    action: "billing.payment_failed",
    targetType: "client",
    targetId: clientRow.id,
    after: { invoiceId: inv.id, amountDue: inv.amount_due },
  });

  const recipients = await membersOfClient(clientRow.id);
  await dispatchEvent({
    recipients,
    eventKey: "billing.payment_failed",
    title: "Payment failed",
    body: "We couldn't charge your card. Please update your payment method.",
    href: "/billing",
    targetType: "client",
    targetId: clientRow.id,
  });
}
