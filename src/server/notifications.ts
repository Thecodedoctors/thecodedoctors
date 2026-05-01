"use server";

import {
  db,
  notifications,
  clientMembers,
  users,
  type NewNotification,
} from "@/db";
import { eq, desc, and, isNull, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Notification system per PORTAL-SPEC.md §8.
 *
 * In-app delivery only in this slice. Email channel arrives in a follow-up
 * once we wire Resend templates per event type. SMS waits for Phase 5.
 */

export type NotifyEvent =
  | "request.message_received"
  | "request.status_changed"
  | "request.approved"
  | "request.urgent_submitted"
  | "request.assigned";

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
  const session = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
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
