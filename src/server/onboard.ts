"use server";

import { db, users, pendingSignups } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { findUserByReferralCode } from "@/server/referrals";
import { getStripe, priceIdFor } from "@/lib/stripe";
import { site } from "@/lib/site";
import { normalizeWebsiteUrl } from "@/lib/url";

/**
 * Commitment-driven sign-up paths. The /login page does NOT create
 * accounts — only successful Stripe Checkout creates them.
 *
 * Both /trial and /start follow the same shape:
 *   1. Validate the form
 *   2. Check the email is unused (defense — Stripe Checkout would
 *      otherwise still complete and we'd discover the conflict on
 *      finalize, refunding the user is messy)
 *   3. Hash the password and write a `pending_signup` row containing
 *      every detail needed to finalize the account, keyed by an
 *      opaque token. Expires in 24h.
 *   4. Create a Stripe Checkout Session with the token in
 *      subscription_data.metadata so finalize can find the row.
 *      `customer_email` pre-fills the email field on Stripe's page.
 *   5. redirect() to checkout.stripe.com/...
 *
 * After successful Checkout, the public /welcome page (not auth-gated
 * because no account exists yet) reads session_id, retrieves the
 * Checkout session from Stripe, calls finalizePendingSignup, then
 * signs the new user in. The webhook also calls finalize as a safety
 * net for the browser-closed case — finalize is idempotent.
 *
 * Trial: 7 days. /start has no trial (immediate billing).
 */

export type OnboardResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const TRIAL_DAYS = 7;
const PENDING_TTL_HOURS = 24;
const ALLOWED_PAID_PLANS = new Set(["general", "premium"]);

/* ──────────────────────────────────────────────────────────────────────────
   Free trial — entered from /checkup results
   ──────────────────────────────────────────────────────────────────────── */

export async function startTrial(
  _prev: OnboardResult | null,
  formData: FormData
): Promise<OnboardResult> {
  const validation = await validateOnboardForm(formData);
  if (!validation.ok) return validation;

  const token = await stashPendingSignup({
    ...validation.data,
    plan: "general",
    signupSource: "trial",
  });
  if (!token.ok) return token;

  return startCheckout({
    email: validation.data.email,
    pendingSignupToken: token.token,
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
  const planRaw = String(formData.get("plan") ?? "general");
  if (!ALLOWED_PAID_PLANS.has(planRaw)) {
    return { ok: false, error: "Pick General Care or Premium Care." };
  }
  const plan = planRaw as "general" | "premium";

  const validation = await validateOnboardForm(formData);
  if (!validation.ok) return validation;

  const token = await stashPendingSignup({
    ...validation.data,
    plan,
    signupSource: "plan",
  });
  if (!token.ok) return token;

  return startCheckout({
    email: validation.data.email,
    pendingSignupToken: token.token,
    plan,
    // No trial on /start — user explicitly picked a paid plan, billed
    // immediately.
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Internals
   ──────────────────────────────────────────────────────────────────────── */

type ValidatedForm = {
  ok: true;
  data: {
    name: string;
    email: string;
    password: string;
    businessName: string;
    websiteUrl: string;
    referredByCode: string | null;
  };
};

async function validateOnboardForm(
  formData: FormData
): Promise<ValidatedForm | { ok: false; error: string }> {
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
  const normalizedUrl = normalizeWebsiteUrl(websiteUrl);
  if (!normalizedUrl)
    return {
      ok: false,
      error: "Enter the URL of the site we'll be treating (e.g. yoursite.com).",
    };
  if (businessName.length < 2)
    return { ok: false, error: "What should we call your business?" };

  const existing = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return {
      ok: false,
      error:
        "An account with that email already exists. Sign in instead, or use a different email.",
    };
  }

  return {
    ok: true,
    data: {
      name,
      email,
      password,
      businessName: businessName.slice(0, 200),
      websiteUrl: normalizedUrl,
      referredByCode: await resolveReferralCode(ref),
    },
  };
}

async function stashPendingSignup(args: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  websiteUrl: string;
  plan: "general" | "premium";
  signupSource: "trial" | "plan";
  referredByCode: string | null;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const passwordHash = await hashPassword(args.password);
    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000
    );

    await db().insert(pendingSignups).values({
      token,
      email: args.email,
      passwordHash,
      userName: args.name,
      businessName: args.businessName,
      websiteUrl: args.websiteUrl,
      plan: args.plan,
      signupSource: args.signupSource,
      referredByCode: args.referredByCode,
      expiresAt,
    });
    return { ok: true, token };
  } catch (err) {
    console.error("[onboard] stash pending failed", err);
    return {
      ok: false,
      error: "Something went wrong. Try again in a moment.",
    };
  }
}

async function startCheckout(args: {
  email: string;
  pendingSignupToken: string;
  plan: "general" | "premium";
  trialPeriodDays?: number;
}): Promise<OnboardResult> {
  const stripe = getStripe();
  const priceId = priceIdFor(args.plan);
  if (!stripe || !priceId) {
    return {
      ok: false,
      error: "Sign-ups are temporarily unavailable. Please try again later.",
    };
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${site.url}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site.url}/trial?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    subscription_data: {
      metadata: {
        pendingSignupToken: args.pendingSignupToken,
        plan: args.plan,
      },
      ...(args.trialPeriodDays
        ? { trial_period_days: args.trialPeriodDays }
        : {}),
    },
    metadata: {
      pendingSignupToken: args.pendingSignupToken,
      plan: args.plan,
    },
  });

  if (!checkout.url) {
    return {
      ok: false,
      error: "Stripe didn't return a checkout URL. Try again.",
    };
  }
  redirect(checkout.url);
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

async function resolveReferralCode(code: string): Promise<string | null> {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{7}$/.test(trimmed)) return null;
  const user = await findUserByReferralCode(trimmed);
  return user ? trimmed : null;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
