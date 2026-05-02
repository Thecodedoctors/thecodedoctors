"use server";

import {
  db,
  users,
  clients,
  clientMembers,
  pendingSignups,
} from "@/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { recordAudit } from "@/server/audit";
import { getStripe } from "@/lib/stripe";

/**
 * Idempotent: converts a pending_signup row into real user/client/
 * client_member records when a Stripe Checkout session has paid.
 *
 * Called from two places:
 *   1. /welcome page on the user's success-url redirect (interactive).
 *   2. The Stripe webhook on checkout.session.completed (safety net for
 *      browser-closed-before-redirect).
 *
 * Idempotency: if a user with the pending_signup's email already
 * exists (because the webhook beat the redirect or vice versa), we
 * just return the existing user id rather than erroring.
 */

export type FinalizeResult =
  | {
      ok: true;
      email: string;
      /** New or existing — caller signs them in either way. */
      userId: string;
      clientId: string;
    }
  | { ok: false; error: string };

export async function finalizePendingSignupBySessionId(
  sessionId: string
): Promise<FinalizeResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Stripe is not configured." };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[finalize] session retrieve failed", err);
    return { ok: false, error: "Couldn't retrieve your checkout session." };
  }

  const status = session.payment_status;
  // status is "paid" for paid plans, "no_payment_required" for trials
  // ($0 today). Both mean the card is on file and we should activate.
  if (status !== "paid" && status !== "no_payment_required") {
    return {
      ok: false,
      error: "Payment is still processing. Refresh in a moment.",
    };
  }

  const token =
    session.metadata?.pendingSignupToken ??
    (typeof session.subscription === "object"
      ? session.subscription?.metadata?.pendingSignupToken
      : undefined) ??
    null;
  if (!token) {
    return {
      ok: false,
      error: "We couldn't tie this checkout back to a sign-up.",
    };
  }

  // Pull the pending row
  const pendingRows = await db()
    .select()
    .from(pendingSignups)
    .where(eq(pendingSignups.token, token))
    .limit(1);
  const pending = pendingRows[0];

  // If the row is gone, finalize must have already run. Look up the
  // user by email and return — keeps the operation idempotent.
  if (!pending) {
    return await reuseFromExistingUser(session);
  }

  if (pending.expiresAt.getTime() < Date.now()) {
    await db().delete(pendingSignups).where(eq(pendingSignups.token, token));
    return {
      ok: false,
      error:
        "Your sign-up link expired. Restart the trial and finish checkout in one sitting.",
    };
  }

  // Defensive: if a user with this email exists despite the pending
  // row still being here, treat as already-finalized.
  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, pending.email))
    .limit(1);
  if (existing.length > 0) {
    await db().delete(pendingSignups).where(eq(pendingSignups.token, token));
    return await reuseFromExistingUser(session);
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  let userId: string;
  let clientId: string;
  try {
    const userRows = await db()
      .insert(users)
      .values({
        name: pending.userName,
        email: pending.email,
        passwordHash: pending.passwordHash,
        role: "client",
      })
      .returning({ id: users.id });
    userId = userRows[0].id;

    const clientRows = await db()
      .insert(clients)
      .values({
        name: pending.businessName,
        websiteUrl: pending.websiteUrl,
        primaryUserId: userId,
        plan: pending.plan as "general" | "premium",
        status: "active",
        signupSource: pending.signupSource,
        referredByCode: pending.referredByCode,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        // trialEndsAt + currentPeriodEnd will populate on the
        // subsequent customer.subscription.updated webhook event.
      })
      .returning({ id: clients.id });
    clientId = clientRows[0].id;

    await db().insert(clientMembers).values({
      clientId,
      userId,
      isAdmin: true,
    });
  } catch (err) {
    console.error("[finalize] account creation failed", err);
    return {
      ok: false,
      error: "Couldn't set up your account. Reach out to hello@thecodedoctors.com.",
    };
  }

  await db().delete(pendingSignups).where(eq(pendingSignups.token, token));

  await recordAudit({
    actorUserId: userId,
    action:
      pending.signupSource === "trial"
        ? "client.trial_started"
        : "client.signed_up",
    targetType: "client",
    targetId: clientId,
    after: {
      plan: pending.plan,
      signupSource: pending.signupSource,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });

  return { ok: true, email: pending.email, userId, clientId };
}

/**
 * The pending row was already consumed (webhook fired, browser
 * reloaded, etc.). Look up the user by the Stripe customer's email
 * and return their ids so the caller can still sign them in.
 */
async function reuseFromExistingUser(
  session: Stripe.Checkout.Session
): Promise<FinalizeResult> {
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) {
    return {
      ok: false,
      error: "Couldn't tie this session back to an email address.",
    };
  }

  const userRows = await db()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (userRows.length === 0) {
    return {
      ok: false,
      error: "No account found for that email.",
    };
  }
  const userId = userRows[0].id;

  const clientRows = await db()
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.primaryUserId, userId))
    .limit(1);
  const clientId = clientRows[0]?.id ?? "";
  return { ok: true, email: userRows[0].email!, userId, clientId };
}
