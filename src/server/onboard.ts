"use server";

import { db, users, clients, clientMembers } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/auth";
import { recordAudit } from "@/server/audit";
import { findUserByReferralCode } from "@/server/referrals";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { site } from "@/lib/site";

/**
 * Commitment-driven sign-up paths. The /login page does NOT create
 * accounts — only /trial and /start can.
 *
 * Both flows now route through Stripe Checkout:
 *   • /trial → mode=subscription with trial_period_days=14. Card is
 *     collected; first charge fires automatically on day 15. No human
 *     "convert to paid" step needed — Stripe handles it.
 *   • /start → mode=subscription with no trial. Charged immediately.
 *
 * Sequence on submit (both):
 *   1. Validate form
 *   2. Create user + client + client_member with status='lead' (no
 *      Stripe linkage yet, no trial_ends_at yet — Stripe will be the
 *      source of truth via webhook)
 *   3. signIn() — sets the session cookie *before* we leave for Stripe
 *      so when the user redirects back they're already authenticated
 *   4. Create Stripe Customer + Checkout session
 *   5. redirect() to checkout.stripe.com URL
 *
 * After successful Checkout, the webhook flips status to 'active' and
 * mirrors the subscription state onto the client row. If the user
 * abandons checkout, they're left as a 'lead' client and can either
 * resume from /dashboard/billing or just let it sit.
 */

export type OnboardResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const TRIAL_DAYS = 14;
const ALLOWED_PAID_PLANS = new Set(["general", "premium"]);

/* ──────────────────────────────────────────────────────────────────────────
   Free trial — entered from /checkup results
   ──────────────────────────────────────────────────────────────────────── */

export async function startTrial(
  _prev: OnboardResult | null,
  formData: FormData
): Promise<OnboardResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim();

  if (name.length < 2)
    return { ok: false, error: "Tell us your name (at least 2 characters)." };
  if (!isValidEmail(email))
    return { ok: false, error: "That doesn't look like a valid email." };
  if (password.length < 8)
    return { ok: false, error: "Pick a password of 8+ characters." };
  if (!isValidUrl(websiteUrl))
    return { ok: false, error: "Enter the URL of the site we'll be treating." };
  if (businessName.length < 2)
    return { ok: false, error: "What should we call your business?" };

  const created = await createUserAndClient({
    name,
    email,
    password,
    businessName: businessName.slice(0, 200),
    websiteUrl: normalizeUrl(websiteUrl),
    plan: "general",
    status: "lead", // flips to 'active' once Stripe Checkout completes
    signupSource: "trial",
    // trialEndsAt left null here — webhook syncs it from sub.trial_end
    trialEndsAt: null,
    referredByCode: await resolveReferralCode(ref),
  });
  if (!created.ok) return created;

  return signInAndStartCheckout({
    email,
    password,
    clientId: created.clientId,
    plan: "general",
    trialPeriodDays: TRIAL_DAYS,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Paid plan — entered from /plans
   ──────────────────────────────────────────────────────────────────────── */

export async function startWithPlan(
  _prev: OnboardResult | null,
  formData: FormData
): Promise<OnboardResult> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const websiteUrl = String(formData.get("websiteUrl") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim();
  const plan = String(formData.get("plan") ?? "general");
  const ref = String(formData.get("ref") ?? "").trim();

  if (name.length < 2)
    return { ok: false, error: "Tell us your name (at least 2 characters)." };
  if (!isValidEmail(email))
    return { ok: false, error: "That doesn't look like a valid email." };
  if (password.length < 8)
    return { ok: false, error: "Pick a password of 8+ characters." };
  if (!isValidUrl(websiteUrl))
    return { ok: false, error: "Enter the URL of the site we'll be treating." };
  if (businessName.length < 2)
    return { ok: false, error: "What should we call your business?" };
  if (!ALLOWED_PAID_PLANS.has(plan))
    return { ok: false, error: "Pick General Care or Premium Care." };

  const created = await createUserAndClient({
    name,
    email,
    password,
    businessName: businessName.slice(0, 200),
    websiteUrl: normalizeUrl(websiteUrl),
    plan: plan as "general" | "premium",
    status: "lead", // flips to 'active' once Stripe Checkout completes
    signupSource: "plan",
    trialEndsAt: null,
    referredByCode: await resolveReferralCode(ref),
  });
  if (!created.ok) return created;

  return signInAndStartCheckout({
    email,
    password,
    clientId: created.clientId,
    plan: plan as "general" | "premium",
    // No trial on /start — user explicitly picked a paid plan, billed
    // immediately.
  });
}

/** Validate a referral code submitted via /trial or /start. Returns the
 *  uppercase code if a user owns it, null otherwise. Anything malformed
 *  becomes null silently — we don't surface "invalid code" errors at
 *  sign-up because legitimate sign-ups shouldn't be blocked on it. */
async function resolveReferralCode(code: string): Promise<string | null> {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{7}$/.test(trimmed)) return null;
  const user = await findUserByReferralCode(trimmed);
  return user ? trimmed : null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Internal — shared user+client creation
   ──────────────────────────────────────────────────────────────────────── */

type CreateResult =
  | { ok: true; userId: string; clientId: string }
  | { ok: false; error: string };

async function createUserAndClient(args: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  websiteUrl: string;
  plan: "general" | "premium";
  status: "active" | "lead";
  signupSource: "trial" | "plan";
  trialEndsAt: Date | null;
  referredByCode: string | null;
}): Promise<CreateResult> {
  // Email must be unused
  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, args.email))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      error:
        "An account with that email already exists. Sign in instead, or use a different email.",
    };
  }

  let userId: string;
  let clientId: string;
  try {
    const hash = await hashPassword(args.password);
    const userRows = await db()
      .insert(users)
      .values({
        name: args.name,
        email: args.email,
        passwordHash: hash,
        role: "client",
      })
      .returning({ id: users.id });
    userId = userRows[0].id;

    const clientRows = await db()
      .insert(clients)
      .values({
        name: args.businessName,
        websiteUrl: args.websiteUrl,
        primaryUserId: userId,
        plan: args.plan,
        status: args.status,
        signupSource: args.signupSource,
        trialEndsAt: args.trialEndsAt,
        referredByCode: args.referredByCode,
      })
      .returning({ id: clients.id });
    clientId = clientRows[0].id;

    await db().insert(clientMembers).values({
      clientId,
      userId,
      isAdmin: true,
    });
  } catch (err) {
    console.error("[onboard] create failed", err);
    return {
      ok: false,
      error: "Something went wrong setting up your account. Try again.",
    };
  }

  // Audit — fire and forget
  await recordAudit({
    actorUserId: userId,
    action:
      args.signupSource === "trial" ? "client.trial_started" : "client.signed_up",
    targetType: "client",
    targetId: clientId,
    after: {
      plan: args.plan,
      signupSource: args.signupSource,
      trialEndsAt: args.trialEndsAt?.toISOString() ?? null,
    },
  });

  return { ok: true, userId, clientId };
}

/**
 * Sign the new user in (sets the session cookie via Auth.js) AND create
 * a Stripe Checkout session for them, then redirect to checkout.
 *
 * The cookie is set on this same response, so when Stripe later
 * redirects the browser back to /dashboard/billing the user is already
 * authenticated — no extra "set password again" or magic-link step.
 *
 * Throws NEXT_REDIRECT (via redirect()) on success, which is the
 * intended end-of-form-action behaviour. The browser follows the 303
 * to checkout.stripe.com.
 */
async function signInAndStartCheckout(args: {
  email: string;
  password: string;
  clientId: string;
  plan: "general" | "premium";
  /** When set, Stripe holds the card and starts the trial period.
   *  First charge fires automatically at trial_period_days. */
  trialPeriodDays?: number;
}): Promise<OnboardResult> {
  // Sign in without redirect so the cookie is set but execution
  // continues. signIn returns the user; we ignore it.
  await signIn("credentials", {
    email: args.email,
    password: args.password,
    redirect: false,
  });

  const stripe = getStripe();
  const priceId = priceIdFor(args.plan);
  if (!stripe || !priceId) {
    // Fall back to dashboard — the user can subscribe from /billing.
    console.error(
      "[onboard] Stripe not configured at checkout, falling back to /dashboard"
    );
    redirect("/dashboard/billing?checkout=stripe-not-configured");
  }

  // Create a Stripe customer linked to the client_id so the webhook can
  // find the right row. Re-use existing customer if the client row
  // already had one (defensive — shouldn't normally happen at signup).
  const clientRows = await db()
    .select({
      stripeCustomerId: clients.stripeCustomerId,
      name: clients.name,
    })
    .from(clients)
    .where(eq(clients.id, args.clientId))
    .limit(1);
  const clientRow = clientRows[0];
  let customerId = clientRow?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: args.email,
      name: clientRow?.name ?? args.email,
      metadata: { clientId: args.clientId },
    });
    customerId = customer.id;
    await db()
      .update(clients)
      .set({ stripeCustomerId: customerId })
      .where(eq(clients.id, args.clientId));
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${site.url}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site.url}/dashboard/billing?checkout=canceled`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: { clientId: args.clientId, plan: args.plan },
      ...(args.trialPeriodDays
        ? { trial_period_days: args.trialPeriodDays }
        : {}),
    },
    metadata: { clientId: args.clientId, plan: args.plan },
  });

  if (!checkout.url) {
    redirect("/dashboard/billing?checkout=stripe-error");
  }
  redirect(checkout.url);
}

/* ──────────────────────────────────────────────────────────────────────────
   Validation helpers
   ──────────────────────────────────────────────────────────────────────── */

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeUrl(s: string): string {
  return new URL(s).toString();
}
