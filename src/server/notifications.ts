"use server";

import {
  db,
  notifications,
  clientMembers,
  users,
  notificationPreferences,
  type NewNotification,
} from "@/db";
import { eq, desc, and, isNull, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { sendBrandEmail } from "@/lib/email";
import type { EmailContent } from "@/lib/email-templates";

/**
 * Notification system per PORTAL-SPEC.md §8.
 *
 * Channels: in-app (always) + email (when the user's preference allows).
 * SMS waits for Phase 5. Per-user preferences live in
 * `notification_preference`; if no row exists for an (user, event) pair
 * the defaults from spec §8.1 are applied.
 */

export type NotifyEvent =
  | "request.message_received"
  | "request.status_changed"
  | "request.approved"
  | "request.urgent_submitted"
  | "request.assigned"
  | "site.went_down"
  | "site.recovered";

/* ──────────────────────────────────────────────────────────────────────────
   Internal — used by other server modules. No `requireUser`; the caller
   is responsible for authorization.
   ──────────────────────────────────────────────────────────────────────── */

export async function notifyUsers(
  userIds: string[],
  payload: Omit<NewNotification, "userId" | "id">
): Promise<void> {
  if (userIds.length === 0) return;
  const rows: NewNotification[] = userIds.map((userId) => ({
    userId,
    eventKey: payload.eventKey,
    title: payload.title,
    body: payload.body,
    href: payload.href,
    targetType: payload.targetType,
    targetId: payload.targetId,
  }));
  try {
    await db().insert(notifications).values(rows);
  } catch (err) {
    // Notifications are non-essential — never fail the parent action.
    console.error("[notifications] insert failed", err);
  }
}

/**
 * Default channel preferences when no `notification_preference` row exists.
 * Mirrors PORTAL-SPEC.md §8.1.
 */
const EMAIL_DEFAULTS: Record<string, boolean> = {
  "request.message_received": true,
  "request.status_changed": true,
  "request.approved": true,
  "request.urgent_submitted": true,
  "request.assigned": false,
  "site.went_down": true,
  "site.recovered": false, // less urgent — in-app only by default
};

/**
 * High-level event dispatcher. Writes one in-app notification per
 * recipient AND sends a branded email to every recipient whose
 * preference for this event allows it (or to all by default).
 *
 * The email argument is optional; events that should be in-app-only
 * (or events for which we haven't built a template yet) skip the
 * email channel entirely.
 */
export async function dispatchEvent(args: {
  recipients: string[];
  eventKey: NotifyEvent | string;
  title: string;
  body?: string | null;
  href?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  email?: EmailContent;
}): Promise<void> {
  if (args.recipients.length === 0) return;

  // 1. In-app — always.
  await notifyUsers(args.recipients, {
    eventKey: args.eventKey,
    title: args.title,
    body: args.body ?? null,
    href: args.href ?? null,
    targetType: args.targetType ?? null,
    targetId: args.targetId ?? null,
  });

  // 2. Email — only if a template was provided AND the recipient's
  //    preference allows. Fire and forget per recipient so a slow
  //    Resend call for one user doesn't block the rest.
  if (!args.email) return;
  if (!process.env.RESEND_API_KEY) return; // dev/no-key environment

  const allowedRecipients = await filterByEmailPreference(
    args.recipients,
    args.eventKey
  );

  await Promise.all(
    allowedRecipients.map(async ({ email }) => {
      if (!email) return;
      try {
        await sendBrandEmail({
          to: email,
          subject: args.email!.subject,
          html: args.email!.html,
        });
      } catch (err) {
        console.error(
          "[notifications] email failed for",
          email,
          "event",
          args.eventKey,
          err
        );
      }
    })
  );
}

/**
 * Returns the subset of recipients who should receive an email for this
 * event — based on notification_preference rows + EMAIL_DEFAULTS fallback.
 */
async function filterByEmailPreference(
  userIds: string[],
  eventKey: string
): Promise<{ userId: string; email: string | null }[]> {
  if (userIds.length === 0) return [];

  // Pull users + their preference for this specific event in one go.
  const rows = await db()
    .select({
      userId: users.id,
      email: users.email,
      prefEmail: notificationPreferences.email,
    })
    .from(users)
    .leftJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.userId, users.id),
        eq(notificationPreferences.eventKey, eventKey)
      )
    )
    .where(inArray(users.id, userIds));

  const fallback = EMAIL_DEFAULTS[eventKey] ?? true;
  return rows.filter((r) => (r.prefEmail ?? fallback) === true);
}

/**
 * Helper: list every member of a client (excluding optionally specified user
 * ids — typically the actor, who shouldn't notify themselves).
 */
export async function membersOfClient(
  clientId: string,
  options: { excludeUserId?: string } = {}
): Promise<string[]> {
  const rows = await db()
    .select({ userId: clientMembers.userId })
    .from(clientMembers)
    .where(eq(clientMembers.clientId, clientId));
  const ids = rows.map((r) => r.userId);
  return options.excludeUserId
    ? ids.filter((id) => id !== options.excludeUserId)
    : ids;
}

/**
 * Helper: list every staff user (any non-client role). Used for staff-side
 * notifications like "urgent request submitted".
 */
export async function staffUserIds(
  options: { excludeUserId?: string } = {}
): Promise<string[]> {
  const rows = await db()
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.role} <> 'client'`);
  const ids = rows.map((r) => r.id);
  return options.excludeUserId
    ? ids.filter((id) => id !== options.excludeUserId)
    : ids;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public — called from pages and the topbar.
   ──────────────────────────────────────────────────────────────────────── */

export async function listNotificationsForCurrentUser(limit = 30) {
  const session = await requireUser();
  return db()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCountForCurrentUser(): Promise<number> {
  const session = await requireUser();
  const rows = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );
  return rows[0]?.n ?? 0;
}

/** Mark a single notification as read. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  return markNotificationReadById(id);
}

/** Same as `markNotificationRead` but callable directly with an id —
 *  used from the notification-row client component which fires the
 *  read-mark from an onClick handler in parallel with navigation. */
export async function markNotificationReadById(id: string): Promise<void> {
  if (!id) return;
  const session = await requireUser();
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );
  revalidatePath("/notifications");
}

/** Mark every unread notification for the current user as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const session = await requireUser();
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );
  revalidatePath("/notifications");
}

/** Bulk dismiss (delete) a set of notifications. */
export async function deleteNotifications(formData: FormData): Promise<void> {
  const session = await requireUser();
  const ids = formData.getAll("id").map(String).filter(Boolean);
  if (ids.length === 0) return;
  await db()
    .delete(notifications)
    .where(
      and(
        inArray(notifications.id, ids),
        eq(notifications.userId, session.user.id)
      )
    );
  revalidatePath("/notifications");
}
