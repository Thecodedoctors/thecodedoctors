import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db, clients, webhookEvents } from "@/db";
import { eq } from "drizzle-orm";
import { getStripe, planFromPriceIdStrict } from "@/lib/stripe";
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

  // Idempotency: skip if we've ALREADY fully processed this event.
  // The ledger row is written only AFTER the handler succeeds (below),
  // so a handler that throws is NOT recorded — Stripe retries it and
  // we reprocess, instead of the old behaviour where a transient
  // failure after the insert permanently dropped the side-effect
  // (paid customer never provisioned). Handlers are upsert/idempotent,
  // so at-least-once delivery is safe.
  try {
    const seen = await db()
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, event.id))
      .limit(1);
    if (seen.length > 0) {
      return NextResponse.json({ received: true, dedup: true });
    }
  } catch (err) {
    console.error("[stripe-webhook] idempotency check failed", err);
    // Can't confirm whether we've processed this — make Stripe retry
    // rather than risk a double or a drop.
    return new NextResponse("Internal error", { status: 500 });
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
      case "charge.refunded":
        await onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      case "charge.dispute.created":
        await onDisputeCreated(event.data.object as Stripe.Dispute);
        break;
      case "customer.subscription.paused":
        await onSubscriptionPaused(event.data.object as Stripe.Subscription);
        break;
      default:
        // Ignore everything we haven't subscribed to. Stripe re-tries
        // 5xx but treats 2xx as accepted, so this is the safe default.
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler failed", event.type, err);
    // 500 makes Stripe retry. The event is intentionally NOT recorded
    // yet, so the retry reprocesses it.
    return new NextResponse("Internal error", { status: 500 });
  }

  // Handler succeeded — record the event so future deliveries dedup.
  // A concurrent duplicate delivery may race to here; the primary key
  // makes the loser a harmless no-op.
  try {
    await db().insert(webhookEvents).values({
      id: event.id,
      source: "stripe",
      eventType: event.type,
    });
  } catch (err) {
    const code =
      typeof (err as { code?: unknown }).code === "string"
        ? (err as { code: string }).code
        : "";
    const dup =
      code === "23505" ||
      String((err as { message?: unknown }).message ?? "").includes(
        "duplicate key"
      );
    if (!dup) {
      // The side-effects already ran; losing the ledger row would only
      // cause a (safe, idempotent) reprocess on retry. Log and ack so
      // we don't pile up retries for work that's actually done.
      console.error("[stripe-webhook] ledger write failed post-handler", err);
    }
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
  // In Stripe API 2024-09+ (we're on 2026-04-22.dahlia) `current_period_end`
  // moved OFF the Subscription onto each Subscription Item. We still
  // fall back to the subscription-level field for older payloads — webhook
  // retries on legacy data shouldn't crash the handler.
  const subType = sub as unknown as {
    items: {
      data: Array<{
        price: {
          id: string;
          unit_amount: number | null;
          recurring?: { interval?: string | null } | null;
        };
        current_period_end?: number;
      }>;
    };
    current_period_end?: number;
    trial_end: number | null;
    cancel_at_period_end: boolean;
  };
  const item = subType.items.data[0];
  const periodEndUnix =
    item?.current_period_end ?? subType.current_period_end ?? null;

  let clientId = sub.metadata?.clientId;
  if (!clientId) {
    // Fall back to lookup by subscription id (already-existing client).
    const existing = await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.stripeSubscriptionId, sub.id))
      .limit(1);
    if (existing.length === 0) {
      // The client row may not exist YET — for a pending-signup the
      // subscription.created event can arrive before
      // checkout.session.completed runs finalize. Returning normally
      // here would record the event as processed and Stripe would
      // never retry, permanently leaving currentPeriodEnd / mrr /
      // trialEndsAt unset. THROW so the route returns 500 and Stripe
      // redelivers until finalize has created the client.
      throw new Error(
        `[stripe-webhook] no client for subscription ${sub.id} yet — retry`
      );
    }
    clientId = existing[0].id;
  }

  // Ownership assertion: the resolved client's Stripe customer must
  // match the subscription's customer. Guards against a stale/forged
  // metadata.clientId mutating a different client's billing state. Skip
  // only when the client has no customer yet (brand-new signup whose
  // customer id is written by finalize after this event).
  const subCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
  const owner = await db()
    .select({ stripeCustomerId: clients.stripeCustomerId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const ownerCustomer = owner[0]?.stripeCustomerId ?? null;
  if (ownerCustomer && subCustomerId && ownerCustomer !== subCustomerId) {
    console.error(
      "[stripe-webhook] subscription/customer ownership mismatch — refusing",
      { clientId, expected: ownerCustomer, got: subCustomerId, sub: sub.id }
    );
    return;
  }

  await applySubscriptionUpdate(clientId, sub, item, periodEndUnix, subType);
}

async function applySubscriptionUpdate(
  clientId: string,
  sub: Stripe.Subscription,
  item:
    | {
        price: {
          id: string;
          unit_amount: number | null;
          recurring?: { interval?: string | null } | null;
        };
      }
    | undefined,
  periodEndUnix: number | null,
  subType: {
    trial_end: number | null;
    cancel_at_period_end: boolean;
  }
) {
  const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
  const priceId = item?.price.id ?? null;
  const billedAmount = item?.price.unit_amount ?? 0;
  const isActive = sub.status === "active" || sub.status === "trialing";

  // Trial state syncs from Stripe — trial_end is null on paid plans.
  const trialEndsAt = subType.trial_end
    ? new Date(subType.trial_end * 1000)
    : null;

  // Cadence comes from the LIVE price object's recurring.interval —
  // never from an env reverse-lookup, which silently breaks on a
  // rotated/stale/legacy price id and would mis-scale MRR by ~12x.
  const interval: "monthly" | "yearly" =
    item?.price.recurring?.interval === "year" ? "yearly" : "monthly";
  const monthlyCents =
    interval === "yearly" ? Math.round(billedAmount / 12) : billedAmount;

  // Plan label: strict match against configured price ids. If the id
  // matches NOTHING (env drift / rotation / legacy / the one-time
  // Checkup price), do NOT guess "general" — that would silently
  // downgrade a paying Premium customer and corrupt entitlements.
  // Leave client.plan untouched and alert instead.
  const resolvedPlan = planFromPriceIdStrict(priceId);
  if (resolvedPlan === null) {
    console.error(
      "[stripe-webhook] UNMAPPED price id — plan label left unchanged",
      { clientId, priceId, sub: sub.id }
    );
  }
  const planUpdate: { plan?: "general" | "premium" } =
    resolvedPlan === null ? {} : { plan: resolvedPlan };

  // Don't clobber locally-set lifecycle states. If ops has paused or
  // discharged this patient, keep that status; the Stripe sub being
  // active doesn't override the operational decision. We only flip
  // status here for the active↔lead transition (renewal, payment
  // recovery), never overwriting paused/discharged.
  const currentRow = await db()
    .select({ status: clients.status })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const currentStatus = currentRow[0]?.status ?? "lead";
  const lockedByOps =
    currentStatus === "paused" || currentStatus === "discharged";
  const nextStatus = lockedByOps
    ? currentStatus
    : isActive
      ? "active"
      : "lead";

  // Mark the Checkup→Care credit consumed the moment a discounted
  // (trialing) conversion subscription actually starts — so it can
  // never be granted a second time on this client. Only set it, never
  // clear it (one-way ledger).
  const consumesCheckupCredit =
    sub.metadata?.checkup_conversion === "true" && trialEndsAt !== null;

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
      status: nextStatus,
      ...(consumesCheckupCredit
        ? { checkupCreditConsumedAt: new Date() }
        : {}),
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
      plan: resolvedPlan ?? "(unmapped — unchanged)",
      interval,
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
  // Clear any prior payment-failed marker — a successful charge means
  // the account is good again. (subscription.updated separately keeps
  // currentPeriodEnd advanced.)
  const subscriptionId =
    (inv as unknown as { subscription?: string | { id: string } | null })
      .subscription;
  const subId =
    typeof subscriptionId === "string"
      ? subscriptionId
      : subscriptionId?.id ?? null;
  if (!subId) return;
  const row = (
    await db()
      .select({ id: clients.id, paymentFailedAt: clients.paymentFailedAt })
      .from(clients)
      .where(eq(clients.stripeSubscriptionId, subId))
      .limit(1)
  )[0];
  if (!row?.paymentFailedAt) return;
  await db()
    .update(clients)
    .set({ paymentFailedAt: null, updatedAt: new Date() })
    .where(eq(clients.id, row.id));
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

  // Stamp the failure so the access gate can revoke after a short
  // grace — otherwise the customer keeps full paid service for the
  // entire Stripe dunning window (weeks) having paid nothing.
  await db()
    .update(clients)
    .set({ paymentFailedAt: new Date(), updatedAt: new Date() })
    .where(eq(clients.id, clientRow.id));

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

/** Resolve a client by Stripe customer id. */
async function clientByCustomer(
  customer: string | { id: string } | null | undefined
): Promise<{ id: string } | null> {
  const customerId =
    typeof customer === "string" ? customer : customer?.id ?? null;
  if (!customerId) return null;
  const row = (
    await db()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.stripeCustomerId, customerId))
      .limit(1)
  )[0];
  return row ?? null;
}

/** Mark a client payment-failed (gate revokes after grace) + zero MRR.
 *  Used by refund / dispute / pause — money came back or stopped. */
async function flagBillingProblem(
  clientId: string,
  reason: string,
  detail: Record<string, unknown>
) {
  await db()
    .update(clients)
    .set({ paymentFailedAt: new Date(), mrrCents: 0, updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  await recordAudit({
    actorUserId: null,
    action: reason,
    targetType: "client",
    targetId: clientId,
    after: detail,
  });
  const recipients = await membersOfClient(clientId);
  await dispatchEvent({
    recipients,
    eventKey: "billing.payment_failed",
    title: "There's a problem with your billing",
    body: "Please check your billing settings or contact us so care isn't interrupted.",
    href: "/billing",
    targetType: "client",
    targetId: clientId,
  });
}

async function onChargeRefunded(charge: Stripe.Charge) {
  // Only act on a FULL refund — partial refunds (goodwill credits)
  // shouldn't revoke access.
  const fullyRefunded =
    charge.refunded === true ||
    (typeof charge.amount === "number" &&
      typeof charge.amount_refunded === "number" &&
      charge.amount_refunded >= charge.amount &&
      charge.amount > 0);
  if (!fullyRefunded) return;
  const client = await clientByCustomer(charge.customer);
  if (!client) return;
  await flagBillingProblem(client.id, "billing.charge_refunded", {
    chargeId: charge.id,
    amountRefunded: charge.amount_refunded,
  });
}

async function onDisputeCreated(dispute: Stripe.Dispute) {
  // A dispute means the money is being clawed back — revoke until it's
  // resolved rather than keep delivering a paid service for free.
  const charge =
    typeof dispute.charge === "string" ? null : dispute.charge ?? null;
  const customer =
    charge && typeof charge === "object" ? charge.customer : null;
  let client = await clientByCustomer(customer);
  if (!client && typeof dispute.charge === "string") {
    // Charge wasn't expanded — best effort via the PI's customer is
    // unavailable here; skip rather than guess.
    client = null;
  }
  if (!client) return;
  await flagBillingProblem(client.id, "billing.dispute_created", {
    disputeId: dispute.id,
    amount: dispute.amount,
    reason: dispute.reason,
  });
}

async function onSubscriptionPaused(sub: Stripe.Subscription) {
  const row =
    (sub.metadata?.clientId
      ? { id: sub.metadata.clientId }
      : (
          await db()
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.stripeSubscriptionId, sub.id))
            .limit(1)
        )[0]) ?? null;
  if (!row) return;
  await db()
    .update(clients)
    .set({ mrrCents: 0, paymentFailedAt: new Date(), updatedAt: new Date() })
    .where(eq(clients.id, row.id));
  await recordAudit({
    actorUserId: null,
    action: "billing.subscription_paused",
    targetType: "client",
    targetId: row.id,
    before: { stripeSubscriptionId: sub.id },
  });
}
