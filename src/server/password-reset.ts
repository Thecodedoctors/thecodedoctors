"use server";

import { db, users, passwordResetTokens } from "@/db";
import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";
import { checkRateLimit } from "@/lib/rate-limit-db";

/**
 * Email-code based password reset.
 *
 * Flow:
 *   1. /forgot-password: user enters email. We always respond with the
 *      same "if we have an account, we sent a code" copy regardless of
 *      whether the email exists — anti-enumeration.
 *   2. We generate a 6-digit code (cryptographically random), hash it
 *      with PBKDF2 (same hashing as passwords), store with a 15-minute
 *      expiry, email the code to the user.
 *   3. /reset-password: user types the code + a new password. We
 *      look up the most recent unused token for that email, verify
 *      the code, update the password, mark the token used.
 *
 * Brute-force defense:
 *   - Rate limited per email: 3 send-requests per hour, 10 verify
 *     attempts per 15 min.
 *   - Per-token: 5 wrong code attempts invalidate the token.
 */

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS_PER_TOKEN = 5;

export type RequestResult = { ok: true } | { ok: false; error: string };
export type VerifyResult = { ok: true } | { ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────────────
   Step 1: request a reset code via email.
   Always returns ok-shaped result so the page can show the same copy
   ("If we have an account…") regardless of whether the email exists.
   The 1-of-1 case where we DO surface an error is on rate-limit hit
   so the user knows to slow down.
   ──────────────────────────────────────────────────────────────────────── */

export async function requestPasswordReset(
  formData: FormData
): Promise<RequestResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email.length > 254) {
    // Same copy as success — don't leak existence on a malformed email.
    return { ok: true };
  }

  // Rate limit per email — 3 sends per hour. A hostile party can't
  // ping the user's inbox repeatedly, and a real user who lost their
  // password gets enough room to retry once or twice.
  const limit = await checkRateLimit({
    scope: "password_reset_request",
    bucket: email,
    limit: 3,
    windowSeconds: 3600,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error:
        "Too many reset requests. Wait an hour, or check the email we already sent.",
    };
  }

  const userRows = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Anti-enumeration: behave the same whether the email exists or not.
  // We *do* skip the email send for suspended/deleted accounts, but
  // the user-facing response is identical.
  const u = userRows[0];
  if (!u || u.suspendedAt || u.deletedAt) {
    return { ok: true };
  }

  // Generate code, hash it, persist.
  const code = generateNumericCode(CODE_LENGTH);
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  await db().insert(passwordResetTokens).values({
    userId: u.id,
    codeHash,
    expiresAt,
  });

  await recordAudit({
    actorUserId: u.id,
    action: "password.reset_requested",
    targetType: "user",
    targetId: u.id,
  });

  try {
    await sendBrandEmail({
      to: u.email!,
      subject: "Your reset code",
      html: renderResetEmail({ name: u.name, code }),
    });
  } catch (err) {
    console.error("[password-reset] email failed", err);
    // We've stashed the row; don't surface infra failures to the user.
  }

  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────────
   Step 2: verify code + set new password.
   ──────────────────────────────────────────────────────────────────────── */

export async function verifyResetCodeAndSetPassword(
  formData: FormData
): Promise<VerifyResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!email) return { ok: false, error: "Enter your email." };
  if (!/^\d{6}$/.test(code))
    return { ok: false, error: "The code is 6 digits." };
  if (newPassword.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  // Brute-force the verify path itself — 10/15min per email.
  const limit = await checkRateLimit({
    scope: "password_reset_verify",
    bucket: email,
    limit: 10,
    windowSeconds: 900,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: "Too many attempts. Wait 15 minutes and try again.",
    };
  }

  const userRows = await db()
    .select({
      id: users.id,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const u = userRows[0];
  if (!u || u.suspendedAt || u.deletedAt) {
    // Don't reveal which email is bad.
    return { ok: false, error: "That code didn't work. Try again." };
  }

  // Most recent unused, unexpired token for this user.
  const tokens = await db()
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, u.id),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  const token = tokens[0];
  if (!token) {
    return {
      ok: false,
      error:
        "No active code. Request a new one — codes expire after 15 minutes.",
    };
  }
  if (token.attempts >= MAX_VERIFY_ATTEMPTS_PER_TOKEN) {
    // Burn the token — too many wrong tries.
    await db()
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, token.id));
    return {
      ok: false,
      error: "Too many wrong tries on this code. Request a new one.",
    };
  }

  const ok = await verifyPassword(code, token.codeHash);
  if (!ok) {
    await db()
      .update(passwordResetTokens)
      .set({ attempts: token.attempts + 1 })
      .where(eq(passwordResetTokens.id, token.id));
    return { ok: false, error: "That code didn't work. Try again." };
  }

  // Update password + burn the token in one go.
  const newHash = await hashPassword(newPassword);
  await db()
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, u.id));
  await db()
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, token.id));

  await recordAudit({
    actorUserId: u.id,
    action: "password.reset_completed",
    targetType: "user",
    targetId: u.id,
  });

  // Email a heads-up so a hijacker can't change the password without
  // the rightful owner finding out.
  try {
    await sendBrandEmail({
      to: email,
      subject: "Your password was changed",
      html: renderPasswordChangedEmail(),
    });
  } catch (err) {
    console.error("[password-reset] notification email failed", err);
  }

  redirect("/login?reset=1&email=" + encodeURIComponent(email));
}

/* ──────────────────────────────────────────────────────────────────────── */

function generateNumericCode(digits: number): string {
  // Reject biased modulo: we draw from 4 random bytes per digit and
  // discard if it falls in the unusable upper range. Fast enough for
  // a 6-digit code.
  let out = "";
  while (out.length < digits) {
    const buf = crypto.getRandomValues(new Uint8Array(1));
    const v = buf[0];
    if (v >= 250) continue; // 250..255 would bias 0..5
    out += String(v % 10);
  }
  return out;
}

function renderResetEmail({
  name,
  code,
}: {
  name: string | null;
  code: string;
}): string {
  const greeting = name ? `Hi ${escapeHtml(name)}.` : "Hi.";
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greeting}</h1>
    <p style="margin:0 0 16px 0;">
      Use this 6-digit code on the password-reset page. It expires in 15 minutes.
    </p>
    <div style="background:#11161D;border:1px solid #1f2733;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0;color:#9AA4B2;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;font-family:ui-monospace,monospace;">Reset code</p>
      <p style="margin:14px 0 0 0;font-family:ui-monospace,monospace;font-size:36px;letter-spacing:0.2em;font-weight:600;">${code}</p>
    </div>
    <p style="margin:0 0 24px 0;">
      <a href="${site.url}/reset-password"
         style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
        Open the reset page
      </a>
    </p>
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      Didn&apos;t request this? You can ignore the email — your password
      hasn&apos;t changed. The code expires on its own.
    </p>
    <p style="margin:32px 0 0 0;color:#9AA4B2;font-size:11px;">${site.name} · ${site.url}</p>
  </div>
</body>
</html>`;
}

function renderPasswordChangedEmail(): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">Your password was changed.</h1>
    <p style="margin:0 0 16px 0;">
      We&apos;re letting you know in case it wasn&apos;t you. If it was, ignore
      this email.
    </p>
    <p style="margin:0 0 24px 0;">
      <strong>If it wasn&apos;t you</strong>: reply to this email immediately
      so we can lock the account.
    </p>
    <p style="margin:32px 0 0 0;color:#9AA4B2;font-size:11px;">${site.name} · ${site.url}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
