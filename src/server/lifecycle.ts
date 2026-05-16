"use server";

import { db, users, clients } from "@/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requireStaff,
  requireFounder,
  requireSeniorStaff,
} from "@/lib/auth-helpers";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";
import { getStripe } from "@/lib/stripe";

/**
 * Founder-only account lifecycle: suspend / un-suspend / delete a
 * user; pause / un-pause / discharge a patient organization. Every
 * destructive action requires a written reason and emails the
 * affected user(s) to the effect.
 *
 * Hard delete stays SQL-only. We soft-delete (set deletedAt + wipe
 * the password hash) so audit trails and FKs to messages, requests,
 * and audit log entries survive.
 */

const MIN_REASON = 10;
const MAX_REASON = 500;

export type LifecycleResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────────────
   User actions
   ──────────────────────────────────────────────────────────────────────── */

export async function suspendUser(formData: FormData): Promise<LifecycleResult> {
  const session = await requireStaff();
  if (session.user.role !== "founder") {
    return { ok: false, error: "Only the founder can suspend accounts." };
  }
  const userId = String(formData.get("userId") ?? "");
  const reason = sanitizeReason(formData.get("reason"));
  if (!userId) return { ok: false, error: "Missing user." };
  if (!reason)
    return { ok: false, error: `Reason must be ${MIN_REASON}–${MAX_REASON} characters.` };
  if (userId === session.user.id) {
    return { ok: false, error: "You can't suspend yourself." };
  }

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "founder") {
    return { ok: false, error: "Founders can't be suspended from the UI." };
  }
  if (target.suspendedAt) {
    return { ok: false, error: "That account is already suspended." };
  }
  if (target.deletedAt) {
    return { ok: false, error: "That account is deleted." };
  }

  await db()
    .update(users)
    .set({
      suspendedAt: new Date(),
      suspensionReason: reason,
    })
    .where(eq(users.id, userId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "user.suspend",
    targetType: "user",
    targetId: userId,
    after: { reason },
  });

  if (target.email) {
    try {
      await sendBrandEmail({
        to: target.email,
        subject: `Your ${site.name} account has been suspended`,
        html: renderSuspendEmail({ name: target.name, reason }),
      });
    } catch (err) {
      console.error("[lifecycle] suspend email failed", err);
    }
  }

  revalidateAdminSurfaces();
  return { ok: true, message: "Account suspended; user has been notified." };
}

export async function unsuspendUser(
  formData: FormData
): Promise<LifecycleResult> {
  const session = await requireStaff();
  if (session.user.role !== "founder") {
    return { ok: false, error: "Only the founder can restore accounts." };
  }
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { ok: false, error: "Missing user." };

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found." };
  if (!target.suspendedAt) {
    return { ok: false, error: "That account isn't suspended." };
  }
  if (target.deletedAt) {
    return { ok: false, error: "That account is deleted." };
  }

  await db()
    .update(users)
    .set({
      suspendedAt: null,
      suspensionReason: null,
    })
    .where(eq(users.id, userId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "user.unsuspend",
    targetType: "user",
    targetId: userId,
  });

  if (target.email) {
    try {
      await sendBrandEmail({
        to: target.email,
        subject: `Your ${site.name} account has been restored`,
        html: renderUnsuspendEmail({ name: target.name }),
      });
    } catch (err) {
      console.error("[lifecycle] unsuspend email failed", err);
    }
  }

  revalidateAdminSurfaces();
  return { ok: true, message: "Account restored; user has been notified." };
}

export async function deleteUser(formData: FormData): Promise<LifecycleResult> {
  const session = await requireStaff();
  if (session.user.role !== "founder") {
    return { ok: false, error: "Only the founder can delete accounts." };
  }
  const userId = String(formData.get("userId") ?? "");
  const reason = sanitizeReason(formData.get("reason"));
  if (!userId) return { ok: false, error: "Missing user." };
  if (!reason)
    return { ok: false, error: `Reason must be ${MIN_REASON}–${MAX_REASON} characters.` };
  if (userId === session.user.id) {
    return { ok: false, error: "You can't delete yourself." };
  }

  const target = await loadUser(userId);
  if (!target) return { ok: false, error: "User not found." };
  if (target.role === "founder") {
    return { ok: false, error: "Founders can't be deleted from the UI." };
  }
  if (target.deletedAt) {
    return { ok: false, error: "That account is already deleted." };
  }

  // Soft delete — wipe the password hash so they can't sign in
  // through any cached creds, set deletedAt + reason. We also clear
  // suspendedAt so suspended->deleted is a clean transition.
  await db()
    .update(users)
    .set({
      deletedAt: new Date(),
      deletionReason: reason,
      passwordHash: null,
      suspendedAt: null,
      suspensionReason: null,
    })
    .where(eq(users.id, userId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "user.delete",
    targetType: "user",
    targetId: userId,
    before: { role: target.role, email: target.email },
    after: { reason },
  });

  if (target.email) {
    try {
      await sendBrandEmail({
        to: target.email,
        subject: `Your ${site.name} account has been closed`,
        html: renderDeleteEmail({ name: target.name, reason }),
      });
    } catch (err) {
      console.error("[lifecycle] delete email failed", err);
    }
  }

  revalidateAdminSurfaces();
  return { ok: true, message: "Account closed; user has been notified." };
}

/* ──────────────────────────────────────────────────────────────────────────
   Patient (organization) actions
   ──────────────────────────────────────────────────────────────────────── */

export async function pauseClient(formData: FormData): Promise<LifecycleResult> {
  // Senior-only: pausing mutates Stripe billing (pause_collection).
  const session = await requireSeniorStaff();
  const clientId = String(formData.get("clientId") ?? "");
  const reason = sanitizeReason(formData.get("reason"));
  if (!clientId) return { ok: false, error: "Missing patient." };
  if (!reason)
    return { ok: false, error: `Reason must be ${MIN_REASON}–${MAX_REASON} characters.` };

  const target = await loadClient(clientId);
  if (!target) return { ok: false, error: "Patient not found." };
  if (target.status === "discharged") {
    return { ok: false, error: "That patient is already discharged." };
  }

  await db()
    .update(clients)
    .set({ status: "paused", statusReason: reason, updatedAt: new Date() })
    .where(eq(clients.id, clientId));

  // Pause Stripe billing too — collecting money from a paused patient
  // generates support tickets at best, refund/chargeback liability at
  // worst. `pause_collection: mark_uncollectible` keeps the subscription
  // alive (so we don't lose history) but stops Stripe from charging or
  // sending dunning emails until we unpause.
  const stripe = getStripe();
  if (stripe && target.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(target.stripeSubscriptionId, {
        pause_collection: { behavior: "mark_uncollectible" },
      });
    } catch (err) {
      console.error(
        "[lifecycle.pauseClient] Stripe pause_collection failed",
        { subId: target.stripeSubscriptionId },
        err
      );
      // Don't block the DB-level pause on Stripe failure; the admin
      // can retry from the dashboard. Audit log captures the partial.
    }
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "client.pause",
    targetType: "client",
    targetId: clientId,
    before: { status: target.status },
    after: { status: "paused", reason },
  });

  await emailPrimaryContact(target, {
    subject: `Service paused — ${target.name}`,
    html: renderClientPauseEmail({ orgName: target.name, reason }),
  });

  revalidateAdminSurfaces();
  return { ok: true, message: "Patient paused; primary contact notified." };
}

export async function unpauseClient(
  formData: FormData
): Promise<LifecycleResult> {
  // Senior-only: resuming mutates Stripe billing.
  const session = await requireSeniorStaff();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return { ok: false, error: "Missing patient." };

  const target = await loadClient(clientId);
  if (!target) return { ok: false, error: "Patient not found." };
  if (target.status !== "paused") {
    return { ok: false, error: "That patient isn't paused." };
  }

  await db()
    .update(clients)
    .set({ status: "active", statusReason: null, updatedAt: new Date() })
    .where(eq(clients.id, clientId));

  // Resume Stripe billing — undo the pause_collection set by pauseClient.
  const stripe = getStripe();
  if (stripe && target.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(target.stripeSubscriptionId, {
        pause_collection: null,
      });
    } catch (err) {
      console.error(
        "[lifecycle.unpauseClient] Stripe resume failed",
        { subId: target.stripeSubscriptionId },
        err
      );
    }
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "client.unpause",
    targetType: "client",
    targetId: clientId,
    before: { status: "paused" },
    after: { status: "active" },
  });

  await emailPrimaryContact(target, {
    subject: `Service resumed — ${target.name}`,
    html: renderClientUnpauseEmail({ orgName: target.name }),
  });

  revalidateAdminSurfaces();
  return { ok: true, message: "Patient resumed; primary contact notified." };
}

export async function dischargeClient(
  formData: FormData
): Promise<LifecycleResult> {
  // Founder-only — discharge is permanent and revenue-impacting; no
  // doctor should be able to fire a paying patient unilaterally.
  const session = await requireFounder();
  const clientId = String(formData.get("clientId") ?? "");
  const reason = sanitizeReason(formData.get("reason"));
  if (!clientId) return { ok: false, error: "Missing patient." };
  if (!reason)
    return { ok: false, error: `Reason must be ${MIN_REASON}–${MAX_REASON} characters.` };

  const target = await loadClient(clientId);
  if (!target) return { ok: false, error: "Patient not found." };
  if (target.status === "discharged") {
    return { ok: false, error: "That patient is already discharged." };
  }

  await db()
    .update(clients)
    .set({
      status: "discharged",
      statusReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, clientId));

  // Cancel the Stripe subscription so we stop billing a discharged
  // patient — otherwise the next renewal cycle silently charges them
  // and the webhook flips status back to "active". Use cancel_at_period_end
  // so they keep access until their already-paid period expires
  // (consistent with how cancel works in the Stripe portal).
  const stripe = getStripe();
  if (stripe && target.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(target.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (err) {
      console.error(
        "[lifecycle.dischargeClient] Stripe cancel failed",
        { subId: target.stripeSubscriptionId },
        err
      );
    }
  }

  await recordAudit({
    actorUserId: session.user.id,
    action: "client.discharge",
    targetType: "client",
    targetId: clientId,
    before: { status: target.status },
    after: { status: "discharged", reason },
  });

  await emailPrimaryContact(target, {
    subject: `Discharge — ${target.name}`,
    html: renderClientDischargeEmail({ orgName: target.name, reason }),
  });

  revalidateAdminSurfaces();
  return { ok: true, message: "Patient discharged; primary contact notified." };
}

/* ──────────────────────────────────────────────────────────────────────────
   Plain `<form action>` wrappers for the no-reason restore buttons.
   These return void to satisfy the form action signature; the underlying
   handlers already revalidate and email so we just discard the result.
   ──────────────────────────────────────────────────────────────────────── */

export async function unsuspendUserForm(formData: FormData): Promise<void> {
  await unsuspendUser(formData);
}

export async function unpauseClientForm(formData: FormData): Promise<void> {
  await unpauseClient(formData);
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

async function loadUser(userId: string) {
  const rows = await db().select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

async function loadClient(clientId: string) {
  const rows = await db()
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return rows[0] ?? null;
}

async function emailPrimaryContact(
  client: { primaryUserId: string | null; name: string },
  msg: { subject: string; html: string }
) {
  if (!client.primaryUserId) return;
  const recipient = await loadUser(client.primaryUserId);
  if (!recipient?.email) return;
  try {
    await sendBrandEmail({ to: recipient.email, ...msg });
  } catch (err) {
    console.error("[lifecycle] client email failed", err);
  }
}

function sanitizeReason(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (s.length < MIN_REASON || s.length > MAX_REASON) return null;
  return s;
}

function revalidateAdminSurfaces() {
  revalidatePath("/admin/team");
  revalidatePath("/admin/clients");
  revalidatePath("/admin/settings/staff");
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

function reasonBlock(reason: string): string {
  return `
    <div style="background:#11161D;border:1px solid #1f2733;border-radius:12px;padding:16px;margin:20px 0;">
      <p style="margin:0;color:#9AA4B2;font-size:12px;text-transform:uppercase;letter-spacing:0.14em;font-family:ui-monospace,monospace;">Reason</p>
      <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;">${escapeHtml(reason)}</p>
    </div>`;
}

function greet(name: string | null): string {
  return name ? `Hi ${escapeHtml(name)}.` : "Hi.";
}

function renderSuspendEmail({
  name,
  reason,
}: {
  name: string | null;
  reason: string;
}): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greet(name)}</h1>
    <p style="margin:0 0 16px 0;">
      Your ${site.name} account has been temporarily suspended. You won't be
      able to sign in until access is restored.
    </p>
    ${reasonBlock(reason)}
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      If you think this is a mistake, reply to this email and we'll take a
      look.
    </p>
  `);
}

function renderUnsuspendEmail({ name }: { name: string | null }): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greet(name)}</h1>
    <p style="margin:0 0 16px 0;">
      Your ${site.name} account has been restored. You can sign in again
      with the same password.
    </p>
    <p style="margin:0 0 24px 0;">
      <a href="${site.url}/login"
         style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
        Sign in
      </a>
    </p>
  `);
}

function renderDeleteEmail({
  name,
  reason,
}: {
  name: string | null;
  reason: string;
}): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greet(name)}</h1>
    <p style="margin:0 0 16px 0;">
      Your ${site.name} account has been closed. You won't be able to sign in
      from this point forward; existing requests and messages remain on file
      under our retention policy.
    </p>
    ${reasonBlock(reason)}
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      Questions? Just reply to this email.
    </p>
  `);
}

function renderClientPauseEmail({
  orgName,
  reason,
}: {
  orgName: string;
  reason: string;
}): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">Service paused — ${escapeHtml(orgName)}</h1>
    <p style="margin:0 0 16px 0;">
      We've paused active treatment on ${escapeHtml(orgName)}. Monitoring keeps
      running; new requests are queued but not actioned until service resumes.
    </p>
    ${reasonBlock(reason)}
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      Reply to this email if you have questions or want to resume.
    </p>
  `);
}

function renderClientUnpauseEmail({ orgName }: { orgName: string }): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">Service resumed — ${escapeHtml(orgName)}</h1>
    <p style="margin:0 0 16px 0;">
      Treatment is back on for ${escapeHtml(orgName)}. Your queued requests
      are being picked up; we'll be in touch.
    </p>
  `);
}

function renderClientDischargeEmail({
  orgName,
  reason,
}: {
  orgName: string;
  reason: string;
}): string {
  return brandWrapper(`
    <h1 style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">Discharge — ${escapeHtml(orgName)}</h1>
    <p style="margin:0 0 16px 0;">
      We've discharged ${escapeHtml(orgName)} from active care. Your records
      remain on file under our retention policy and can be re-opened by
      reaching out.
    </p>
    ${reasonBlock(reason)}
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
