"use server";

import {
  db,
  requests,
  clients,
  users,
  type Request as RequestRow,
  type NewRequest,
} from "@/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireStaff, isStaff } from "@/lib/auth-helpers";
import {
  getOrCreateClientForUser,
  userBelongsToClient,
} from "@/lib/clients";
import { recordAudit } from "@/server/audit";

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

  // Stuff URL into the description if provided — keeps the schema simple
  // until Phase 3 v2 adds a dedicated `url` column.
  const fullDescription = url
    ? `${description}\n\n— URL: ${url}`
    : description;

  const row: NewRequest = {
    clientId: client.id,
    submittedByUserId: session.user.id,
    title,
    description: fullDescription,
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

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/requests");
  redirect(`/dashboard/requests/${inserted.id}`);
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
    before: { status: before[0].status },
    after: { status },
  });

  revalidatePath(`/admin/requests/${requestId}`);
  revalidatePath("/admin");
  revalidatePath(`/dashboard/requests/${requestId}`);
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
