"use server";

import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireUser, requireFounder } from "@/lib/auth-helpers";
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotp,
} from "@/lib/totp";
import { hashPassword, verifyPassword } from "@/lib/password";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * TOTP (authenticator-app) two-factor for both staff and patients.
 *
 * Flow:
 *   1. /settings/security → "Set up authenticator" — server generates a
 *      secret, builds the otpauth URI, renders a QR code data URI, and
 *      stashes the secret on the user row. The flag `totpEnabled`
 *      stays false until the user proves they've scanned successfully.
 *   2. User scans, enters their first 6-digit code.
 *   3. `verifyAndEnableTotp` confirms the code, flips `totpEnabled`,
 *      generates 10 single-use recovery codes (returned ONCE so the
 *      user can save them), stores their PBKDF2 hashes.
 *   4. Login surface verifies the code on every sign-in via
 *      `signInVerifyTotp` (called from auth.ts authorize()).
 *
 * Recovery codes are consumable: each correct code removes its hash
 * from the array. Once exhausted, the user has to regenerate via
 * /settings/security (which invalidates any leftover ones).
 */

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 10; // base32 chars, 50 bits
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/0/1

export type TotpSetupBundle = {
  secret: string;
  otpauthUri: string;
  qrCodeDataUrl: string;
};

export type EnableResult =
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; error: string };

export type DisableResult = { ok: true } | { ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────────────
   Setup — generate a secret + QR for the user to scan.
   ──────────────────────────────────────────────────────────────────────── */

export async function startTotpSetup(): Promise<TotpSetupBundle> {
  const session = await requireUser();
  if (!session.user.email) {
    throw new Error("Account has no email — can't set up authenticator.");
  }

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri({ secret, email: session.user.email });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
    margin: 1,
    width: 220,
    color: { dark: "#0a0e13", light: "#f2f4f7" },
  });

  // Stash the secret. `totpEnabled` stays false until verification —
  // a user who walks away mid-setup never has 2FA partially turned on.
  await db()
    .update(users)
    .set({ totpSecret: secret })
    .where(eq(users.id, session.user.id));

  return { secret, otpauthUri, qrCodeDataUrl };
}

/* ──────────────────────────────────────────────────────────────────────────
   Verify the first code, enable 2FA, generate recovery codes.
   ──────────────────────────────────────────────────────────────────────── */

export async function verifyAndEnableTotp(
  formData: FormData
): Promise<EnableResult> {
  const session = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code from your app." };
  }

  const rows = await db()
    .select({
      totpSecret: users.totpSecret,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const me = rows[0];
  if (!me?.totpSecret) {
    return {
      ok: false,
      error: "Setup wasn't started. Refresh and try again.",
    };
  }
  if (me.totpEnabled) {
    return {
      ok: false,
      error: "Authenticator is already enabled on this account.",
    };
  }

  const ok = await verifyTotp(me.totpSecret, code);
  if (!ok) {
    return {
      ok: false,
      error: "That code doesn't match. Try the next one your app shows.",
    };
  }

  // Generate + persist recovery codes (hashed).
  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => hashPassword(c)));
  await db()
    .update(users)
    .set({
      totpEnabled: true,
      totpRecoveryCodes: JSON.stringify(hashes),
    })
    .where(eq(users.id, session.user.id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "two_factor.totp_enabled",
    targetType: "user",
    targetId: session.user.id,
  });

  revalidatePath("/settings/security");
  return { ok: true, recoveryCodes: codes };
}

/* ──────────────────────────────────────────────────────────────────────────
   Disable — wiped from the user row entirely. Requires password
   confirmation so a hijacked-but-not-2FA'd session can't unlock the
   account.
   ──────────────────────────────────────────────────────────────────────── */

export async function disableTotp(formData: FormData): Promise<DisableResult> {
  const session = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!password) {
    return { ok: false, error: "Enter your password to confirm." };
  }

  const rows = await db()
    .select({
      passwordHash: users.passwordHash,
      totpEnabled: users.totpEnabled,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const me = rows[0];
  if (!me?.totpEnabled) {
    return { ok: false, error: "Authenticator isn't enabled." };
  }
  if (!me.passwordHash) {
    return { ok: false, error: "Password isn't set on this account." };
  }
  const ok = await verifyPassword(password, me.passwordHash);
  if (!ok) return { ok: false, error: "That password isn't right." };

  await db()
    .update(users)
    .set({
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodes: null,
    })
    .where(eq(users.id, session.user.id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "two_factor.totp_disabled",
    targetType: "user",
    targetId: session.user.id,
  });

  revalidatePath("/settings/security");
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────────
   Regenerate recovery codes (useful if user lost their saved set).
   ──────────────────────────────────────────────────────────────────────── */

export async function regenerateRecoveryCodes(): Promise<EnableResult> {
  const session = await requireUser();
  const rows = await db()
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!rows[0]?.totpEnabled) {
    return { ok: false, error: "Enable authenticator first." };
  }

  const codes = generateRecoveryCodes();
  const hashes = await Promise.all(codes.map((c) => hashPassword(c)));
  await db()
    .update(users)
    .set({ totpRecoveryCodes: JSON.stringify(hashes) })
    .where(eq(users.id, session.user.id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "two_factor.recovery_codes_regenerated",
    targetType: "user",
    targetId: session.user.id,
  });

  revalidatePath("/settings/security");
  return { ok: true, recoveryCodes: codes };
}

/* ──────────────────────────────────────────────────────────────────────────
   Founder unlock — when a user loses both their device + recovery
   codes. Wipes their TOTP state so they can sign in with password
   alone, and emails them so a hijacker who triggered this can't do it
   silently. Founder-only by deliberate choice; this is the most
   privileged 2FA action in the system.
   ──────────────────────────────────────────────────────────────────────── */

export type ResetTwoFactorResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function resetTwoFactorForUser(
  formData: FormData
): Promise<ResetTwoFactorResult> {
  const session = await requireFounder();
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!userId) return { ok: false, error: "Missing user." };
  if (reason.length < 10 || reason.length > 500) {
    return { ok: false, error: "Reason must be 10–500 characters." };
  }
  if (userId === session.user.id) {
    return {
      ok: false,
      error: "You can't reset your own 2FA from here — disable it from /settings/security.",
    };
  }

  const rows = await db()
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const target = rows[0];
  if (!target) return { ok: false, error: "User not found." };
  if (!target.totpEnabled) {
    return { ok: false, error: "That account doesn't have 2FA enabled." };
  }

  await db()
    .update(users)
    .set({
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodes: null,
    })
    .where(eq(users.id, userId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "two_factor.founder_reset",
    targetType: "user",
    targetId: userId,
    after: { reason },
  });

  if (target.email) {
    try {
      await sendBrandEmail({
        to: target.email,
        subject: `Your 2FA was reset — ${site.name}`,
        html: renderResetEmail({ name: target.name, reason }),
      });
    } catch (err) {
      console.error("[two-factor] founder-reset email failed", err);
    }
  }

  revalidatePath("/admin/team");
  revalidatePath(`/admin/clients`);
  return { ok: true, message: "2FA reset; user has been notified." };
}

function renderResetEmail({
  name,
  reason,
}: {
  name: string | null;
  reason: string;
}): string {
  const greeting = name
    ? `Hi ${escapeHtml(name)}.`
    : "Hi.";
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greeting}</h1>
    <p style="margin:0 0 16px 0;">
      Your two-factor authentication was reset by the founder. You can sign in
      with your password alone again — please re-enable 2FA at
      <span style="color:#F2F4F7;font-family:ui-monospace,monospace;">Settings → Security</span>
      as soon as you do.
    </p>
    <div style="background:#11161D;border:1px solid #1f2733;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#9AA4B2;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;font-family:ui-monospace,monospace;">Reason</p>
      <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;">${escapeHtml(reason)}</p>
    </div>
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      If this wasn&apos;t you and you didn&apos;t request a reset, reply to
      this email immediately so we can lock the account.
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

/* ──────────────────────────────────────────────────────────────────────────
   Helpers consumed by auth.ts during sign-in (NOT a server action — just
   a regular async function reused inside authorize()).
   ──────────────────────────────────────────────────────────────────────── */

/** Verify a TOTP code OR a recovery code for a given user. Recovery
 *  codes are consumed (their hash removed) on successful match. */
export async function verifyTotpForLogin(
  userId: string,
  rawCode: string
): Promise<boolean> {
  const cleaned = rawCode.replace(/\s+/g, "").toUpperCase();
  if (!cleaned) return false;

  const rows = await db()
    .select({
      totpSecret: users.totpSecret,
      totpRecoveryCodes: users.totpRecoveryCodes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const me = rows[0];
  if (!me?.totpSecret) return false;

  // Plain 6-digit code → TOTP check.
  if (/^\d{6}$/.test(cleaned)) {
    return verifyTotp(me.totpSecret, cleaned);
  }

  // Recovery code path. Stored as `[hash, hash, …]` JSON.
  if (!me.totpRecoveryCodes) return false;
  let hashes: string[];
  try {
    hashes = JSON.parse(me.totpRecoveryCodes) as string[];
  } catch {
    return false;
  }
  const candidate = cleaned.replace(/-/g, ""); // user may type with dashes
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPassword(candidate, hashes[i])) {
      // Consume — remove this hash so the code can't be reused.
      hashes.splice(i, 1);
      await db()
        .update(users)
        .set({ totpRecoveryCodes: JSON.stringify(hashes) })
        .where(eq(users.id, userId));
      return true;
    }
  }
  return false;
}

/* ──────────────────────────────────────────────────────────────────────────
   Plain `<form action>` wrappers for the inline forms.
   ──────────────────────────────────────────────────────────────────────── */

export async function startTotpSetupForm(): Promise<void> {
  // Trigger the setup so the page can render the QR on the same render
  // pass via a refetch — NOT used currently (UI uses a client component
  // that calls startTotpSetup directly), but included for completeness.
  await startTotpSetup();
  redirect("/settings/security");
}

/* ──────────────────────────────────────────────────────────────────────── */

function generateRecoveryCodes(): string[] {
  const out: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const buf = crypto.getRandomValues(new Uint8Array(RECOVERY_CODE_LENGTH));
    let code = "";
    for (let j = 0; j < buf.length; j++) {
      code += RECOVERY_ALPHABET[buf[j] % RECOVERY_ALPHABET.length];
    }
    // Insert a dash mid-code for readability when the user writes them down.
    out.push(`${code.slice(0, 5)}-${code.slice(5)}`);
  }
  return out;
}
