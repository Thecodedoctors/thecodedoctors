"use server";

import { db, users } from "@/db";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendBrandEmail } from "@/lib/email";
import { renderEmailVerifyEmail } from "@/lib/email-templates";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";
import { requireUser } from "@/lib/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit-db";

/**
 * Post-payment email verification. The account is created the moment
 * Stripe completes; this layer adds proof-of-ownership of the email
 * AFTER the fact, with zero friction at signup.
 *
 * Flow:
 *   1. finalizePendingSignup creates the user with `emailVerified=null`
 *      and immediately calls `sendVerificationCodeForUserId` so the
 *      patient gets the email before they even land on /dashboard.
 *   2. Patient sees a banner on the dashboard prompting them to verify.
 *   3. Patient clicks the magic link in the email → token-based GET
 *      verification flips `emailVerified` to NOW.
 *   4. OR patient enters the 6-digit code on /verify-email → same.
 *   5. Patient can request a fresh code from /verify-email if the
 *      original expired (24h) or never arrived. Rate-limited to 1
 *      resend per minute, 5 per day per user.
 *
 * The hashed code uses the same PBKDF2 routine as passwords so the
 * stored value never leaks the active code if the DB is dumped.
 */

const CODE_TTL_HOURS = 24;
const MAX_ATTEMPTS = 5;

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────────
   Issuance — generate a fresh code+token and email both to the user
   ──────────────────────────────────────────────────────────────────── */

function genSixDigitCode(): string {
  const buf = crypto.getRandomValues(new Uint8Array(4));
  // Big-endian 32-bit unsigned, mod 1_000_000, zero-padded.
  const n =
    ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

function genToken(): string {
  const buf = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (let i = 0; i < buf.length; i++) s += buf[i].toString(16).padStart(2, "0");
  return s;
}

/**
 * Used internally by finalizePendingSignup AND by the resend action.
 * Generates a fresh code + token, stores their hashes, and emails
 * both to the user.
 */
export async function sendVerificationCodeForUserId(
  userId: string
): Promise<VerifyResult> {
  const rows = await db()
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user || !user.email) {
    return { ok: false, error: "Account not found." };
  }

  const code = genSixDigitCode();
  const token = genToken();
  const codeHash = await hashPassword(code);

  await db()
    .update(users)
    .set({
      emailVerificationCodeHash: codeHash,
      emailVerificationToken: token,
      emailVerificationSentAt: new Date(),
      emailVerificationAttempts: 0,
    })
    .where(eq(users.id, userId));

  const link = `${site.url}/verify-email?token=${encodeURIComponent(token)}`;
  try {
    await sendBrandEmail({
      to: user.email,
      subject: "Verify your email — The Code Doctors",
      html: renderEmailVerifyEmail({
        name: user.name ?? user.email.split("@")[0],
        code,
        link,
      }),
    });
  } catch (err) {
    console.error("[email-verification] send failed", err);
    return {
      ok: false,
      error: "Couldn't send the verification email — try again in a minute.",
    };
  }

  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────
   Verification — by code (form) or by token (magic link)
   ──────────────────────────────────────────────────────────────────── */

/**
 * Server action — patient enters the 6-digit code on /verify-email.
 * Verifies, marks the user as verified, redirects to dashboard.
 */
export async function verifyEmailWithCode(formData: FormData): Promise<void> {
  const session = await requireUser();
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(code)) {
    redirect("/verify-email?error=bad-code");
  }

  const rows = await db()
    .select({
      hash: users.emailVerificationCodeHash,
      sentAt: users.emailVerificationSentAt,
      attempts: users.emailVerificationAttempts,
      verifiedAt: users.emailVerified,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const row = rows[0];
  if (!row) redirect("/verify-email?error=not-found");
  if (row.verifiedAt) redirect("/dashboard?verified=already");

  if (!row.hash || !row.sentAt) {
    redirect("/verify-email?error=no-code");
  }
  if (Date.now() - row.sentAt.getTime() > CODE_TTL_HOURS * 60 * 60 * 1000) {
    redirect("/verify-email?error=expired");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    redirect("/verify-email?error=too-many-attempts");
  }

  const ok = await verifyPassword(code, row.hash);
  if (!ok) {
    await db()
      .update(users)
      .set({ emailVerificationAttempts: (row.attempts ?? 0) + 1 })
      .where(eq(users.id, session.user.id));
    redirect("/verify-email?error=wrong-code");
  }

  await markVerified(session.user.id);
  redirect("/dashboard?verified=just-now");
}

// `verifyEmailWithToken` lives in src/lib/email-verification-core.ts.
// It's a plain async function (NOT a server action) so the page can
// call it from a Server Component render and then `redirect()`
// without Next confusing the action-return + redirect sequence.

async function markVerified(userId: string): Promise<void> {
  await db()
    .update(users)
    .set({
      emailVerified: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationToken: null,
      emailVerificationSentAt: null,
      emailVerificationAttempts: 0,
    })
    .where(eq(users.id, userId));

  await recordAudit({
    actorUserId: userId,
    action: "user.email_verified",
    targetType: "user",
    targetId: userId,
  });

  revalidatePath("/dashboard");
}

/* ──────────────────────────────────────────────────────────────────────
   Resend
   ──────────────────────────────────────────────────────────────────── */

/**
 * Server action — patient clicks "Resend code" on /verify-email or the
 * dashboard banner. Rate-limited to 5 per day per user (DB-backed) so
 * a stuck UI loop doesn't burn through Resend quota.
 */
export async function resendVerificationCode(): Promise<void> {
  const session = await requireUser();

  // Already verified — no-op.
  const rows = await db()
    .select({ verifiedAt: users.emailVerified })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (rows[0]?.verifiedAt) {
    redirect("/dashboard?verified=already");
  }

  const limit = await checkRateLimit({
    scope: "email_verify_resend",
    bucket: session.user.id,
    limit: 5,
    windowSeconds: 24 * 60 * 60,
  });
  if (!limit.ok) {
    redirect("/verify-email?error=rate-limited");
  }

  const result = await sendVerificationCodeForUserId(session.user.id);
  if (!result.ok) {
    redirect("/verify-email?error=send-failed");
  }
  redirect("/verify-email?resent=1");
}

/* ──────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

/** Suppress unused-import warning in dev. */
void and;
void isNull;
