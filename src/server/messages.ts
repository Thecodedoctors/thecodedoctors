"use server";

import {
  db,
  messages,
  requests,
  users,
  clients,
  type NewMessage,
} from "@/db";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, isStaff } from "@/lib/auth-helpers";
import {
  userBelongsToClient,
  requireActiveOrTrialing,
} from "@/lib/clients";
import { recordAudit } from "@/server/audit";
import { dispatchEvent, membersOfClient } from "@/server/notifications";
import {
  emailMessageReceived,
  emailPatientReplied,
} from "@/lib/email-templates";

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
    .select({
      clientId: requests.clientId,
      title: requests.title,
      assignedDoctorId: requests.assignedDoctorId,
      clientName: clients.name,
      clientStatus: clients.status,
      clientTrialEndsAt: clients.trialEndsAt,
      clientStripeSubscriptionId: clients.stripeSubscriptionId,
      clientCancelAtPeriodEnd: clients.cancelAtPeriodEnd,
      clientCurrentPeriodEnd: clients.currentPeriodEnd,
    })
    .from(requests)
    .innerJoin(clients, eq(clients.id, requests.clientId))
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
    // Trial expired / paused / discharged patients can read but
    // can't post new messages. Staff (caregivers) are exempt — they
    // need to be able to wrap up an open thread.
    const eligibility = await requireActiveOrTrialing({
      status: reqRows[0].clientStatus,
      trialEndsAt: reqRows[0].clientTrialEndsAt,
      stripeSubscriptionId: reqRows[0].clientStripeSubscriptionId,
      cancelAtPeriodEnd: reqRows[0].clientCancelAtPeriodEnd,
      currentPeriodEnd: reqRows[0].clientCurrentPeriodEnd,
    });
    if (!eligibility.ok) {
      return { ok: false, error: eligibility.reason };
    }
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

  // Audit log every message — staff actions, client replies, internal notes.
  // Phase 5 will add a viewer at /admin/audit; for now the log is silent
  // insurance.
  await recordAudit({
    actorUserId: session.user.id,
    action: internal
      ? "message.add_internal"
      : staff
        ? "message.add_staff"
        : "message.add_client",
    targetType: "request",
    targetId: requestId,
  });

  // Notifications. Skip internal notes — staff-only audience already gets
  // them in the inbox view; an extra in-app notification per internal would
  // be noisy.
  if (!internal) {
    const requestRow = reqRows[0];
    const preview = body.slice(0, 240);
    const authorName = session.user.name ?? "Your doctor";
    if (staff) {
      // Staff replied → notify the patient(s).
      const recipients = await membersOfClient(requestRow.clientId, {
        excludeUserId: session.user.id,
      });
      await dispatchEvent({
        recipients,
        eventKey: "request.message_received",
        title: `${authorName} replied`,
        body: `On "${requestRow.title}": ${body.slice(0, 120)}`,
        href: `/requests/${requestId}`,
        targetType: "request",
        targetId: requestId,
        email: emailMessageReceived({
          authorName,
          requestTitle: requestRow.title,
          preview,
          requestId,
        }),
      });
    } else if (requestRow.assignedDoctorId) {
      // Patient replied → notify the assigned doctor only (not the whole staff).
      await dispatchEvent({
        recipients: [requestRow.assignedDoctorId],
        eventKey: "request.message_received",
        title: "Patient replied",
        body: `On "${requestRow.title}": ${body.slice(0, 120)}`,
        href: `/requests/${requestId}`,
        targetType: "request",
        targetId: requestId,
        email: emailPatientReplied({
          clientName: requestRow.clientName,
          requestTitle: requestRow.title,
          preview,
          requestId,
        }),
      });
    }
  }

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath("/notifications");
  revalidatePath("/dashboard"); // hub's "needs your reply" feed
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
