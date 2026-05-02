"use server";

import { db, users, clients, clientMembers } from "@/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/auth";
import { recordAudit } from "@/server/audit";
import { findUserByReferralCode } from "@/server/referrals";

/**
 * Commitment-driven sign-up paths. The /login page does NOT create
 * accounts — only /trial and /start can. Both flows:
 *   1. Validate inputs
 *   2. Create user + client + client_member in one shot
 *   3. Mark the signup_source so we can analyse funnel later
 *   4. Sign the user in via Auth.js
 *
 * The patient's commitment differs:
 *   • /trial → 14-day free trial, plan='general', trialEndsAt set
 *   • /start → paid plan picked, trialEndsAt null
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
    status: "active",
    signupSource: "trial",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
    referredByCode: await resolveReferralCode(ref),
  });
  if (!created.ok) return created;

  return signInAndRedirect(email, password, "/dashboard");
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
    status: "active",
    signupSource: "plan",
    trialEndsAt: null,
    referredByCode: await resolveReferralCode(ref),
  });
  if (!created.ok) return created;

  return signInAndRedirect(email, password, "/dashboard");
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

async function createUserAndClient(args: {
  name: string;
  email: string;
  password: string;
  businessName: string;
  websiteUrl: string;
  plan: "general" | "premium";
  status: "active";
  signupSource: "trial" | "plan";
  trialEndsAt: Date | null;
  referredByCode: string | null;
}): Promise<OnboardResult> {
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

  return { ok: true, redirectTo: "/dashboard" };
}

async function signInAndRedirect(
  email: string,
  password: string,
  redirectTo: string
): Promise<OnboardResult> {
  // signIn() throws NEXT_REDIRECT on success — must let it propagate.
  // We don't return ok-true because the redirect short-circuits the form.
  await signIn("credentials", {
    email,
    password,
    redirectTo,
  });
  // Defensive — should be unreachable.
  redirect(redirectTo);
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
