"use server";

import { db, users, pendingSignups } from "@/db";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { encryptAutoSigninPassword } from "@/lib/auto-signin-crypto";
import { findUserByReferralCode } from "@/server/referrals";
import {
  getStripe,
  priceIdFor,
  priceIdForCheckup,
  type BillingInterval,
} from "@/lib/stripe";
import { site } from "@/lib/site";
import { normalizeWebsiteUrl } from "@/lib/url";
import { validateEmailDeliverability } from "@/lib/email-validation";

/**
 * Commitment-driven sign-up paths. The /login page does NOT create
 * accounts — only successful Stripe Checkout creates them.
 *
 * Three entry shapes share the same internals:
 *   - /trial         → 7-day free trial of General Care (Checkout in
 *                      subscription mode with trial_period_days=7)
 *   - /start (paid)  → General or Premium, monthly OR yearly billing
 *                      (Checkout in subscription mode, no trial)
 *   - /start?plan=checkup → one-time $599 deep audit (Checkout in
 *                      `payment` mode — no recurring billing)
 *
 * All three:
 *   1. Validate the form
 *   2. Check the email is unused
 *   3. Hash the password and write a `pending_signup` row keyed by an
 *      opaque token. Expires in 24h.
 *   4. Create a Stripe Checkout Session with the token in metadata.
 *   5. redirect() to checkout.stripe.com/...
 *
 * After successful Checkout, /welcome reads session_id, calls finalize,
 * then signs the new user in. The webhook also calls finalize as a
 * safety net for the browser-closed case — finalize is idempotent.
 */

export type OnboardResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

const TRIAL_DAYS = 7;
const PENDING_TTL_HOURS = 24;
const ALLOWED_PAID_PLANS = new Set(["general", "premium"]);
const ALLOWED_INTERVALS = new Set(["monthly", "yearly"]);

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

  return startSubscriptionCheckout({
    email: validation.data.email,
    pendingSignupToken: token.token,
    plan: "general",
    interval: "monthly",
    trialPeriodDays: TRIAL_DAYS,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Paid plan — entered from /start
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

  const intervalRaw = String(formData.get("interval") ?? "monthly");
  if (!ALLOWED_INTERVALS.has(intervalRaw)) {
    return { ok: false, error: "Pick monthly or yearly billing." };
  }
  const interval = intervalRaw as BillingInterval;

  const validation = await validateOnboardForm(formData);
  if (!validation.ok) return validation;

  const token = await stashPendingSignup({
    ...validation.data,
    plan,
    signupSource: "plan",
  });
  if (!token.ok) return token;

  return startSubscriptionCheckout({
    email: validation.data.email,
    pendingSignupToken: token.token,
    plan,
    interval,
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   The Checkup — one-time $599 deep audit
   ──────────────────────────────────────────────────────────────────────── */

export async function startWithCheckup(
  _prev: OnboardResult | null,
  formData: FormData
): Promise<OnboardResult> {
  const validation = await validateOnboardForm(formData);
  if (!validation.ok) return validation;

  const token = await stashPendingSignup({
    ...validation.data,
    plan: "checkup",
    signupSource: "checkup",
  });
  if (!token.ok) return token;

  return startCheckupCheckout({
    email: validation.data.email,
    pendingSignupToken: token.token,
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

  // Plausibility check — reject disposable domains + typo'd domains
  // with no MX records before charging anyone. Real proof-of-ownership
  // verification happens post-payment via the 6-digit code.
  const emailCheck = await validateEmailDeliverability(email);
  if (!emailCheck.ok) {
    return { ok: false, error: emailCheck.message };
  }

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

  // DB-touching checks wrapped so a cold-start / transient Neon error
  // returns a friendly banner instead of bubbling to the Critical page
  // on /start or /trial (no error.tsx covers a thrown server action).
  let referredByCode: string | null;
  try {
    const existing = await db()
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (existing.length > 0) {
      return {
        ok: false,
        error:
          "An account with that email already exists. Sign in instead, or use a different email.",
      };
    }
    referredByCode = await resolveReferralCode(ref);
  } catch (err) {
    console.error("[onboard] validate form db check failed", err);
    return {
      ok: false,
      error: "Something went wrong on our end. Try again in a moment.",
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
      referredByCode,
    },
  };
}

async function stashPendingSignup(args: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  websiteUrl: string;
  plan: "general" | "premium" | "checkup";
  signupSource: "trial" | "plan" | "checkup";
  referredByCode: string | null;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const passwordHash = await hashPassword(args.password);
    // Encrypted plaintext, lives ~minutes (until /welcome runs).
    // Used once by /welcome to auto-sign-in the user without making
    // them retype the password they just chose 30 seconds ago. Cleared
    // when finalize wipes the pending_signup row.
    const autoSigninPassword = await encryptAutoSigninPassword(args.password);
    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000
    );

    await db().insert(pendingSignups).values({
      token,
      email: args.email,
      passwordHash,
      autoSigninPassword,
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

async function startSubscriptionCheckout(args: {
  email: string;
  pendingSignupToken: string;
  plan: "general" | "premium";
  interval: BillingInterval;
  trialPeriodDays?: number;
}): Promise<OnboardResult> {
  const stripe = getStripe();
  const priceId = priceIdFor(args.plan, args.interval);
  if (!stripe || !priceId) {
    return {
      ok: false,
      error: "Sign-ups are temporarily unavailable. Please try again later.",
    };
  }

  let checkout: Awaited<
    ReturnType<typeof stripe.checkout.sessions.create>
  >;
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: args.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site.url}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site.url}/start?canceled=1`,
      // Off: a forever/100%-off coupon stacked on the trial = free
      // recurring care. No launch campaign uses promo codes.
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      subscription_data: {
        metadata: {
          pendingSignupToken: args.pendingSignupToken,
          plan: args.plan,
          interval: args.interval,
        },
        ...(args.trialPeriodDays
          ? { trial_period_days: args.trialPeriodDays }
          : {}),
      },
      metadata: {
        pendingSignupToken: args.pendingSignupToken,
        plan: args.plan,
        interval: args.interval,
      },
    });
  } catch (err) {
    // Stripe threw (bad/mismatched price id, restricted key, account
    // not live-activated, network blip). Return a banner instead of
    // letting it bubble to the global Critical page. The pending_signup
    // row is harmless — it expires in 24h and finalize is idempotent.
    console.error("[onboard] stripe subscription checkout failed", err);
    return {
      ok: false,
      error: "Sign-ups are temporarily unavailable. Please try again in a moment.",
    };
  }

  if (!checkout.url) {
    return {
      ok: false,
      error: "Stripe didn't return a checkout URL. Try again.",
    };
  }
  redirect(checkout.url);
}

async function startCheckupCheckout(args: {
  email: string;
  pendingSignupToken: string;
}): Promise<OnboardResult> {
  const stripe = getStripe();
  const priceId = priceIdForCheckup();
  if (!stripe || !priceId) {
    return {
      ok: false,
      error: "Checkup purchases are temporarily unavailable. Try again shortly.",
    };
  }

  // `payment` mode = one-time charge, no subscription. Stripe still
  // creates a Customer record for us so future upgrades to ongoing care
  // can reuse the saved card.
  let checkout: Awaited<
    ReturnType<typeof stripe.checkout.sessions.create>
  >;
  try {
    // `payment` mode = one-time charge, no subscription. Stripe still
    // creates a Customer record for us so future upgrades to ongoing
    // care can reuse the saved card.
    checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: args.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${site.url}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site.url}/start?plan=checkup&canceled=1`,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      // Save the customer + payment intent so we can issue refunds
      // later (the money-back guarantee on Checkup) without manual
      // lookup.
      customer_creation: "always",
      payment_intent_data: {
        metadata: {
          pendingSignupToken: args.pendingSignupToken,
          plan: "checkup",
        },
      },
      metadata: {
        pendingSignupToken: args.pendingSignupToken,
        plan: "checkup",
      },
    });
  } catch (err) {
    console.error("[onboard] stripe checkup checkout failed", err);
    return {
      ok: false,
      error: "Checkup purchases are temporarily unavailable. Try again shortly.",
    };
  }

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
