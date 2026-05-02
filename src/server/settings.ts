"use server";

import { db, users, notificationPreferences } from "@/db";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { hashPassword, verifyPassword } from "@/lib/password";
import { recordAudit } from "@/server/audit";

/* ──────────────────────────────────────────────────────────────────────────
   Profile — name only, since email is the auth identifier.
   ──────────────────────────────────────────────────────────────────────── */

export type ProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateProfileName(
  _prev: ProfileResult | null,
  formData: FormData
): Promise<ProfileResult> {
  const session = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return { ok: false, error: "Name can't be empty." };
  if (name.length > 120)
    return { ok: false, error: "Name is too long (max 120 characters)." };

  await db()
    .update(users)
    .set({ name })
    .where(eq(users.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────────
   Security — change password.
   ──────────────────────────────────────────────────────────────────────── */

export type PasswordResult =
  | { ok: true }
  | { ok: false; error: string };

export async function changePassword(
  _prev: PasswordResult | null,
  formData: FormData
): Promise<PasswordResult> {
  const session = await requireUser();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 8)
    return { ok: false, error: "New password must be at least 8 characters." };
  if (next !== confirm)
    return { ok: false, error: "New passwords don't match." };
  if (next === current)
    return { ok: false, error: "New password must differ from the current one." };

  const rows = await db()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (rows.length === 0) return { ok: false, error: "Account not found." };

  // If a hash exists, the current password must match. If no hash exists yet
  // (account predates the credentials switch), allow setting it without one.
  if (rows[0].passwordHash) {
    const ok = await verifyPassword(current, rows[0].passwordHash);
    if (!ok) return { ok: false, error: "Current password is incorrect." };
  }

  const newHash = await hashPassword(next);
  await db()
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, session.user.id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "user.password_changed",
    targetType: "user",
    targetId: session.user.id,
  });

  revalidatePath("/settings/security");
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────────────────
   Notification preferences — per-event email toggle.
   The static catalogues (CLIENT_EVENTS / STAFF_EVENTS) live in
   src/lib/notification-events.ts so they can be imported from non-action
   modules; this file (`"use server"`) can only export async functions.
   ──────────────────────────────────────────────────────────────────────── */

/** Returns an effective email preference for each event in `eventKeys`,
 *  falling back to the default when no row exists. */
export async function listEmailPreferencesForCurrentUser(
  eventKeys: string[]
): Promise<Record<string, boolean>> {
  const session = await requireUser();
  if (eventKeys.length === 0) return {};

  const rows = await db()
    .select({
      eventKey: notificationPreferences.eventKey,
      email: notificationPreferences.email,
    })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.userId, session.user.id),
        inArray(notificationPreferences.eventKey, eventKeys)
      )
    );

  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.eventKey] = r.email;
  return out;
}

export async function updateEmailPreferences(
  formData: FormData
): Promise<void> {
  const session = await requireUser();

  // Form submits all keys present in the catalogue; checkbox absence = off.
  // The hidden `events` field carries the list of keys the form covered so
  // we know which rows to upsert (avoids deleting unrelated preferences).
  const keys = formData.getAll("event").map(String).filter(Boolean);
  if (keys.length === 0) return;

  for (const eventKey of keys) {
    const enabled = formData.get(`email:${eventKey}`) === "on";

    await db()
      .insert(notificationPreferences)
      .values({
        userId: session.user.id,
        eventKey,
        inApp: true,
        email: enabled,
        sms: false,
        digest: "immediate",
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.eventKey,
        ],
        set: { email: enabled },
      });
  }

  revalidatePath("/settings/notifications");
}
