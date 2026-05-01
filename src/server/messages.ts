"use server";

import { db, messages, requests, users, type NewMessage } from "@/db";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, isStaff } from "@/lib/auth-helpers";
import { userBelongsToClient } from "@/lib/clients";
import { recordAudit } from "@/server/audit";

type MessageResult = { ok: true } | { ok: false; error: string };

/**
 * Add a message to a request thread. Clients can only post visible messages
 * on requests within their own client; staff can post on any request, with
 * an `internal` flag that hides from the client.
 */
export async function addMessage(
  _prev: MessageResult | null,
  formData: FormData
): Promise<MessageResult> {
  const session = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const wantsInternal = formData.get("internal") === "on";

  if (!requestId) return { ok: false, error: "Missing request id." };
  if (body.length < 1) return { ok: false, error: "Message can't be empty." };
  if (body.length > 5000)
    return { ok: false, error: "Message is too long (max 5000 chars)." };

  const reqRows = await db()
    .select({ clientId: requests.clientId })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (reqRows.length === 0)
    return { ok: false, error: "Request not found." };

  const staff = isStaff(session.user.role);
  if (!staff) {
    const ok = await userBelongsToClient(
      session.user.id,
      reqRows[0].clientId
    );
    if (!ok) return { ok: false, error: "Not authorized." };
  }

  // Only staff can post internal notes.
  const internal = staff && wantsInternal;

  const row: NewMessage = {
    requestId,
    authorUserId: session.user.id,
    body,
    internal,
  };
  await db().insert(messages).values(row);

  // Touch the parent request so it sorts first.
  await db()
    .update(requests)
    .set({ updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  if (staff) {
    await recordAudit({
      actorUserId: session.user.id,
      action: internal ? "message.add_internal" : "message.add",
      targetType: "request",
      targetId: requestId,
    });
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/dashboard/requests/${requestId}`);
  return { ok: true };
}

/**
 * Get messages for a request, scoped to the caller's role.
 * Clients never see internal notes.
 */
export async function listMessagesForRequest(requestId: string) {
  const session = await requireUser();

  const rows = await db()
    .select({
      id: messages.id,
      body: messages.body,
      internal: messages.internal,
      createdAt: messages.createdAt,
      authorId: messages.authorUserId,
      authorName: users.name,
      authorEmail: users.email,
      authorRole: users.role,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorUserId))
    .where(eq(messages.requestId, requestId))
    .orderBy(asc(messages.createdAt));

  if (isStaff(session.user.role)) return rows;
  return rows.filter((m) => !m.internal);
}
