"use server";

import {
  db,
  requests,
  messages,
  clients,
  users,
  type Request as RequestRow,
  type NewRequest,
} from "@/db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireStaff, isStaff } from "@/lib/auth-helpers";
import {
  getOrCreateClientForUser,
  userBelongsToClient,
} from "@/lib/clients";
import { recordAudit } from "@/server/audit";
import {
  notifyUsers,
  membersOfClient,
  staffUserIds,
} from "@/server/notifications";
import { statusLabel } from "@/components/status-pill";

const ALLOWED_TYPES = new Set([
  "bug",
  "improvement",
  "security",
  "seo",
  "performance",
  "redesign",
  "other",
]);
const ALLOWED_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const ALLOWED_STATUSES = new Set([
  "triaged",
  "diagnosed",
  "in_treatment",
  "in_review",
  "healed",
  "closed",
]);

type FormResult = { ok: true; id: string } | { ok: false; error: string };

/* ──────────────────────────────────────────────────────────────────────────
   Client-side actions
   ──────────────────────────────────────────────────────────────────────── */

export async function createRequest(
  _prev: FormResult | null,
  formData: FormData
): Promise<FormResult> {
  const session = await requireUser("/dashboard/requests/new");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const type = String(formData.get("type") ?? "improvement");
  const priority = String(formData.get("priority") ?? "medium");

  if (title.length < 3 || title.length > 200) {
    return { ok: false, error: "Title must be 3–200 characters." };
  }
  if (description.length < 10 || description.length > 5000) {
    return { ok: false, error: "Description must be 10–5000 characters." };
  }
  if (!ALLOWED_TYPES.has(type)) {
    return { ok: false, error: "Pick a valid request type." };
  }
  if (!ALLOWED_PRIORITIES.has(priority)) {
    return { ok: false, error: "Pick a valid priority." };
  }

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const row: NewRequest = {
    clientId: client.id,
    submittedByUserId: session.user.id,
    title,
    description,
    url: url || null,
    type: type as NewRequest["type"],
    priority: priority as NewRequest["priority"],
    status: "triaged",
  };

  let inserted: RequestRow;
  try {
    const result = await db().insert(requests).values(row).returning();
    inserted = result[0];
  } catch (err) {
    console.error("[requests] create failed", err);
    return { ok: false, error: "Couldn't save your request. Try again." };
  }

  // Notify staff about the new request — urgent gets a stronger event key
  // so we can route those differently in the future.
  const eventKey =
    priority === "urgent"
      ? "request.urgent_submitted"
      : "request.message_received";
  const recipients = await staffUserIds({ excludeUserId: session.user.id });
  await notifyUsers(recipients, {
    eventKey,
    title:
      priority === "urgent"
        ? `Urgent · ${client.name}`
        : `New request · ${client.name}`,
    body: title.slice(0, 140),
    href: `/requests/${inserted.id}`,
    targetType: "request",
    targetId: inserted.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  revalidatePath("/admin");
  revalidatePath("/notifications");
  // Bare path — proxy.ts on the live site will resolve this to the right
  // file under /dashboard/* via subdomain rewrite.
  redirect(`/requests/${inserted.id}`);
}

export async function listRequestsForCurrentUser() {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  return db()
    .select({
      id: requests.id,
      title: requests.title,
      type: requests.type,
      priority: requests.priority,
      status: requests.status,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(eq(requests.clientId, client.id))
    .orderBy(desc(requests.updatedAt));
}

/**
 * Open requests where the LAST visible message was sent by someone other
 * than the current user — i.e., "the ball is in your court."
 *
 * Implementation: pull each request's latest non-internal message, filter
 * client-side. Adequate for any single client's volume; if a patient ever
 * has hundreds of open requests we'll move this to a SQL window function.
 */
export async function needsYourReplyForCurrentUser() {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  // 1. All open requests.
  const open = await db()
    .select({
      id: requests.id,
      title: requests.title,
      type: requests.type,
      priority: requests.priority,
      status: requests.status,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(
      and(
        eq(requests.clientId, client.id),
        sql`${requests.status} not in ('healed','closed')`
      )
    );

  if (open.length === 0) return [];

  // 2. Latest visible message per request, with author id.
  const ids = open.map((r) => r.id);
  const lastMessages = await db()
    .select({
      requestId: messages.requestId,
      authorId: messages.authorUserId,
      createdAt: messages.createdAt,
      body: messages.body,
    })
    .from(messages)
    .where(
      and(
        inArray(messages.requestId, ids),
        eq(messages.internal, false)
      )
    )
    .orderBy(desc(messages.createdAt));

  // Map: requestId -> latest message for that request
  const latestByRequest = new Map<
    string,
    { authorId: string | null; createdAt: Date; body: string }
  >();
  for (const m of lastMessages) {
    if (!latestByRequest.has(m.requestId)) {
      latestByRequest.set(m.requestId, {
        authorId: m.authorId,
        createdAt: new Date(m.createdAt),
        body: m.body,
      });
    }
  }

  // 3. Filter to requests where last message wasn't from this user.
  const meId = session.user.id;
  return open
    .filter((r) => {
      const last = latestByRequest.get(r.id);
      return last && last.authorId !== meId;
    })
    .map((r) => {
      const last = latestByRequest.get(r.id)!;
      return {
        ...r,
        lastReplyAt: last.createdAt,
        lastReplyPreview: last.body.slice(0, 140),
      };
    })
    .sort((a, b) => b.lastReplyAt.getTime() - a.lastReplyAt.getTime());
}

/**
 * Open requests in active states (Reviewed / In progress / Awaiting approval)
 * — the work-in-flight panel for the patient hub.
 */
export async function inProgressForCurrentUser() {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  return db()
    .select({
      id: requests.id,
      title: requests.title,
      type: requests.type,
      priority: requests.priority,
      status: requests.status,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(
      and(
        eq(requests.clientId, client.id),
        sql`${requests.status} in ('diagnosed','in_treatment','in_review')`
      )
    )
    .orderBy(desc(requests.updatedAt));
}

export async function getRequestForCurrentUser(requestId: string) {
  const session = await requireUser();

  const rows = await db()
    .select({
      request: requests,
      clientName: clients.name,
      assignedDoctorName: users.name,
      assignedDoctorEmail: users.email,
    })
    .from(requests)
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .leftJoin(users, eq(users.id, requests.assignedDoctorId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];

  // Authorization: staff can see anything; clients only their own client's.
  if (!isStaff(session.user.role)) {
    const allowed = await userBelongsToClient(session.user.id, row.request.clientId);
    if (!allowed) return null;
  }

  return row;
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff-side actions
   ──────────────────────────────────────────────────────────────────────── */

export async function listAllRequestsForStaff() {
  await requireStaff();
  return db()
    .select({
      id: requests.id,
      title: requests.title,
      type: requests.type,
      priority: requests.priority,
      status: requests.status,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      clientId: requests.clientId,
      clientName: clients.name,
      assignedDoctorName: users.name,
    })
    .from(requests)
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .leftJoin(users, eq(users.id, requests.assignedDoctorId))
    .orderBy(desc(requests.updatedAt));
}

export async function staffStats() {
  await requireStaff();
  const [open, healthy, urgent] = await Promise.all([
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(requests)
      .where(
        and(
          sql`${requests.status} not in ('healed', 'closed')`
        )
      ),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(clients)
      .where(eq(clients.status, "active")),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(requests)
      .where(eq(requests.priority, "urgent")),
  ]);
  return {
    openRequests: open[0]?.n ?? 0,
    activeClients: healthy[0]?.n ?? 0,
    urgentRequests: urgent[0]?.n ?? 0,
  };
}

/** Used directly as a form action — no useActionState needed. */
export async function updateRequestStatus(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!requestId || !ALLOWED_STATUSES.has(status)) return;

  const before = await db()
    .select()
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (before.length === 0) return;
  const previous = before[0];
  if (previous.status === status) return; // no-op

  await db()
    .update(requests)
    .set({
      status: status as NewRequest["status"],
      updatedAt: new Date(),
    })
    .where(eq(requests.id, requestId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "request.update_status",
    targetType: "request",
    targetId: requestId,
    before: { status: previous.status },
    after: { status },
  });

  // Notify patient(s) about the status change.
  const recipients = await membersOfClient(previous.clientId, {
    excludeUserId: session.user.id,
  });
  await notifyUsers(recipients, {
    eventKey: "request.status_changed",
    title: `Status changed to ${statusLabel(status)}`,
    body: `On "${previous.title}"`,
    href: `/requests/${requestId}`,
    targetType: "request",
    targetId: requestId,
  });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

/**
 * Patient approves a deliverable — moves status from in_review to healed.
 * Spec §4.1 journey 6, §5 capability matrix.
 */
export async function approveRequest(formData: FormData): Promise<void> {
  const session = await requireUser("/dashboard");
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;
  if (isStaff(session.user.role)) return; // staff don't self-approve

  const before = await db()
    .select()
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);
  if (before.length === 0) return;
  if (before[0].status !== "in_review") return;

  // Authorization: must belong to the request's client.
  const ok = await userBelongsToClient(session.user.id, before[0].clientId);
  if (!ok) return;

  await db()
    .update(requests)
    .set({ status: "healed", updatedAt: new Date() })
    .where(eq(requests.id, requestId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "request.approved",
    targetType: "request",
    targetId: requestId,
    before: { status: "in_review" },
    after: { status: "healed" },
  });

  // Notify the assigned doctor (or all staff if unassigned).
  const audience = before[0].assignedDoctorId
    ? [before[0].assignedDoctorId]
    : await staffUserIds();
  await notifyUsers(audience, {
    eventKey: "request.approved",
    title: "Patient approved · Resolved",
    body: `On "${before[0].title}"`,
    href: `/requests/${requestId}`,
    targetType: "request",
    targetId: requestId,
  });

  revalidatePath(`/dashboard/requests/${requestId}`);
  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/notifications");
}

/** Used directly as a form action — no useActionState needed. */
export async function assignRequestToSelf(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const requestId = String(formData.get("requestId") ?? "");
  if (!requestId) return;

  await db()
    .update(requests)
    .set({
      assignedDoctorId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(requests.id, requestId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "request.assign_self",
    targetType: "request",
    targetId: requestId,
    after: { assignedDoctorId: session.user.id },
  });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
}
