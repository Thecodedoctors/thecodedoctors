"use server";

import {
  db,
  users,
  clients,
  clientMembers,
  pendingSignups,
} from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { recordAudit } from "@/server/audit";
import { getStripe } from "@/lib/stripe";
import { signIn } from "@/auth";
import { decryptAutoSigninPassword } from "@/lib/auto-signin-crypto";

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
      /** Plaintext password decrypted from pending_signup, used once
       *  by /welcome for the auto-sign-in. Null when the row was
       *  already consumed (e.g. webhook beat the redirect) — caller
       *  falls back to the manual sign-in form in that case. */
      autoSigninPassword: string | null;
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
        plan: pending.plan as "general" | "premium" | "checkup",
        status: "active",
        signupSource: pending.signupSource,
        referredByCode: pending.referredByCode,
        stripeCustomerId: customerId,
        // Subscriptions populate stripeSubscriptionId; one-time Checkup
        // purchases stay null here (no recurring billing). The webhook
        // for `customer.subscription.updated` later populates this for
        // the recurring plans.
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

  // Decrypt the one-time auto-signin password BEFORE deleting the
  // pending row. Falls back to null if AUTH_SECRET is missing or the
  // ciphertext is malformed — caller will show the manual sign-in
  // form in that case.
  let autoSigninPassword: string | null = null;
  if (pending.autoSigninPassword) {
    try {
      autoSigninPassword = await decryptAutoSigninPassword(
        pending.autoSigninPassword
      );
    } catch (err) {
      console.error("[finalize] auto-signin decrypt failed", err);
    }
  }

  await db().delete(pendingSignups).where(eq(pendingSignups.token, token));

  await recordAudit({
    actorUserId: userId,
    action:
      pending.signupSource === "trial"
        ? "client.trial_started"
        : pending.signupSource === "checkup"
          ? "client.checkup_purchased"
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

  // Send the verification email so the patient can confirm ownership
  // post-payment. Two reasons this is delicate on Cloudflare Workers:
  //   1. Resend's API can take 1-3s — too long to block /welcome's
  //      response on, since the user is staring at a blank page.
  //   2. Plain fire-and-forget (`void promise.catch(...)`) gets the
  //      in-flight fetch killed when the worker response is sent.
  //      Token is in DB but the email never reaches Resend.
  // The right primitive is `ctx.waitUntil(promise)` — keeps the
  // promise alive past the response. Fallback to awaiting if context
  // isn't available (e.g. running in `next dev`).
  const sendPromise = (async () => {
    try {
      const { sendVerificationCodeForUserId } = await import(
        "@/server/email-verification"
      );
      await sendVerificationCodeForUserId(userId);
    } catch (err) {
      console.error(
        "[finalize] verification email send failed (non-fatal)",
        err
      );
    }
  })();
  try {
    const { getCloudflareContext } = await import(
      "@opennextjs/cloudflare"
    );
    const cfCtx = getCloudflareContext();
    if (cfCtx?.ctx?.waitUntil) {
      cfCtx.ctx.waitUntil(sendPromise);
    } else {
      await sendPromise;
    }
  } catch {
    // Cloudflare context not available (dev / preview) — just await.
    await sendPromise;
  }

  return {
    ok: true,
    email: pending.email,
    userId,
    clientId,
    autoSigninPassword,
  };
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
  // No autoSigninPassword on this path — the pending row was already
  // consumed. Caller falls back to the manual sign-in form.
  return {
    ok: true,
    email: userRows[0].email!,
    userId,
    clientId,
    autoSigninPassword: null,
  };
}

/**
 * Top-level server action used by the /welcome sign-in form (the
 * fallback shown when auto-signin couldn't recover the plaintext
 * password). Reads email + password from the formData and calls
 * Auth.js signIn with redirectTo=/dashboard.
 *
 * If signIn fails (wrong password), redirects back to /welcome with
 * an error flag instead of letting the AuthError bubble up to the
 * Critical / global-error page.
 */
export async function signInFromWelcome(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!email || password.length < 8) {
    redirectToWelcomeWithError(sessionId, "ShortPassword");
  }
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    // Auth.js uses NEXT_REDIRECT on success — let those bubble out.
    if (err && typeof err === "object" && "digest" in err) {
      const digest = String((err as { digest?: unknown }).digest ?? "");
      if (digest.startsWith("NEXT_REDIRECT")) throw err;
    }
    if (err && typeof err === "object" && "name" in err) {
      const name = String((err as { name?: unknown }).name ?? "");
      if (name === "CredentialsSignin" || name.includes("Auth")) {
        redirectToWelcomeWithError(sessionId, "WrongPassword");
      }
    }
    throw err;
  }
}

function redirectToWelcomeWithError(sessionId: string, code: string): never {
  const qs = new URLSearchParams();
  if (sessionId) qs.set("session_id", sessionId);
  qs.set("error", code);
  redirect(`/welcome?${qs.toString()}`);
}
