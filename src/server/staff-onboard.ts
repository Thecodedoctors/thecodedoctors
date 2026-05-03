"use server";

import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth-helpers";
import { hashPassword } from "@/lib/password";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * Founder-only staff onboarding.
 *
 * `inviteStaffMember` does one of two things based on whether a user
 * with the given email already exists:
 *
 *   • Existing user (any role) → updates their role to the chosen staff
 *     role. Existing password / 2FA / sessions are preserved. They get
 *     an email confirming the promotion.
 *   • No user → creates a new user with a random temporary password
 *     and the chosen role. They get an email with the password and a
 *     sign-in link; we expect them to change it on first login via
 *     /settings/security.
 *
 * Founder role is intentionally NOT in the allowlist — promoting to
 * founder is a SQL-only operation by design. Same for readonly →
 * founder demotions.
 */

const ASSIGNABLE_ROLES = ["doctor", "senior_doctor", "readonly"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_LABEL: Record<AssignableRole, string> = {
  doctor: "Doctor",
  senior_doctor: "Senior doctor",
  readonly: "Read-only access",
};

export type InviteResult =
  | { ok: true; mode: "created" | "promoted"; email: string }
  | { ok: false; error: string };

export async function inviteStaffMember(
  formData: FormData
): Promise<InviteResult> {
  const session = await requireStaff();
  if (session.user.role !== "founder") {
    return { ok: false, error: "Only the founder can add staff." };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const roleRaw = String(formData.get("role") ?? "");

  if (!isValidEmail(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }
  if (!ASSIGNABLE_ROLES.includes(roleRaw as AssignableRole)) {
    return { ok: false, error: "Pick a role from the list." };
  }
  const role = roleRaw as AssignableRole;

  const existing = await db()
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    const u = existing[0];
    if (u.role === "founder") {
      return {
        ok: false,
        error:
          "That account is already a founder — founder demotions are SQL-only.",
      };
    }
    if (u.role === role) {
      return {
        ok: false,
        error: `That account is already ${ROLE_LABEL[role].toLowerCase()}.`,
      };
    }

    await db()
      .update(users)
      .set({ role })
      .where(eq(users.id, u.id));

    await recordAudit({
      actorUserId: session.user.id,
      action: "staff.promote",
      targetType: "user",
      targetId: u.id,
      before: { role: u.role },
      after: { role },
    });

    try {
      await sendBrandEmail({
        to: email,
        subject: `You've been added to the practice — ${site.name}`,
        html: renderPromotionEmail({ name: u.name ?? name, role }),
      });
    } catch (err) {
      console.error("[staff-onboard] promotion email failed", err);
      // The promotion still landed — surface a partial success.
      revalidatePath("/admin/settings/staff");
      revalidatePath("/admin/team");
      return {
        ok: false,
        error:
          "Promotion saved, but the email couldn't be sent. Tell them yourself.",
      };
    }

    revalidatePath("/admin/settings/staff");
    revalidatePath("/admin/team");
    return { ok: true, mode: "promoted", email };
  }

  // Create a fresh user.
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const userId = crypto.randomUUID();

  await db().insert(users).values({
    id: userId,
    email,
    name: name || null,
    role,
    passwordHash,
    twoFactorRequired: role !== "readonly",
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "staff.invite",
    targetType: "user",
    targetId: userId,
    after: { email, role, name: name || null },
  });

  try {
    await sendBrandEmail({
      to: email,
      subject: `Welcome to ${site.name}`,
      html: renderInviteEmail({
        name: name || null,
        role,
        tempPassword,
      }),
    });
  } catch (err) {
    // We don't roll back the user — the founder can resend by re-inviting.
    console.error("[staff-onboard] invite email failed", err);
    revalidatePath("/admin/settings/staff");
    revalidatePath("/admin/team");
    return {
      ok: false,
      error:
        "Account created, but the welcome email couldn't be sent. Use 'Resend invite' or share the temp password directly.",
    };
  }

  revalidatePath("/admin/settings/staff");
  revalidatePath("/admin/team");
  return { ok: true, mode: "created", email };
}

/* ──────────────────────────────────────────────────────────────────────── */

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/** Crypto-strong 16-character temp password. Sent once via email; the
 *  recipient is expected to change it from /settings/security on first
 *  login. */
function generateTempPassword(): string {
  const alphabet =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = crypto.getRandomValues(new Uint8Array(16));
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
   Emails — inline HTML, brand tokens duplicated as literals.
   ──────────────────────────────────────────────────────────────────────── */

function brandWrapper(body: string): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    ${body}
    <p style="margin:32px 0 0 0;color:#9AA4B2;font-size:11px;">${site.name} · ${site.url}</p>
  </div>
</body>
</html>`;
}

function renderInviteEmail({
  name,
  role,
  tempPassword,
}: {
  name: string | null;
  role: AssignableRole;
  tempPassword: string;
}): string {
  const greeting = name ? `Welcome, ${escapeHtml(name)}.` : "Welcome.";
  return brandWrapper(`
    <h1 style="font-size:28px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greeting}</h1>
    <p style="margin:0 0 16px 0;">
      You've been added to the practice as a
      <strong style="color:#F2F4F7;">${ROLE_LABEL[role]}</strong>.
      Sign in below — we generated a temporary password for you.
    </p>
    <div style="background:#11161D;border:1px solid #1f2733;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0;color:#9AA4B2;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;font-family:ui-monospace,monospace;">Temporary password</p>
      <p style="margin:10px 0 0 0;font-family:ui-monospace,monospace;font-size:20px;letter-spacing:0.04em;">${escapeHtml(tempPassword)}</p>
    </div>
    <p style="margin:0 0 24px 0;">
      <a href="https://admin.thecodedoctors.com/login?next=/admin"
         style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
        Sign in
      </a>
    </p>
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      Once you're in, change this password under
      <span style="color:#F2F4F7;font-family:ui-monospace,monospace;">Settings → Security</span>.
      ${
        role === "readonly"
          ? "Read-only access doesn't require 2FA."
          : "We'll prompt you to enable 2FA — please do; it's required for staff."
      }
    </p>
  `);
}

function renderPromotionEmail({
  name,
  role,
}: {
  name: string | null;
  role: AssignableRole;
}): string {
  const greeting = name ? `Hi ${escapeHtml(name)}.` : "Hi.";
  return brandWrapper(`
    <h1 style="font-size:28px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greeting}</h1>
    <p style="margin:0 0 16px 0;">
      Your role on ${site.name} was just changed to
      <strong style="color:#F2F4F7;">${ROLE_LABEL[role]}</strong>.
      Sign in with your existing password — no reset needed.
    </p>
    <p style="margin:0 0 24px 0;">
      <a href="https://admin.thecodedoctors.com/login?next=/admin"
         style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
        Open the practice portal
      </a>
    </p>
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      Questions? Just reply to this email.
    </p>
  `);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
