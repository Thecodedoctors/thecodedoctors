"use server";

import {
  db,
  clients,
  users,
  clientMembers,
  requests,
  healthChecks,
  type Client,
} from "@/db";
import { eq, sql, and, ilike, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff, isStaff } from "@/lib/auth-helpers";
import { recordAudit } from "@/server/audit";
import { normalizeWebsiteUrl } from "@/lib/url";

export type ClientListRow = {
  id: string;
  name: string;
  plan: string;
  status: string;
  mrrCents: number;
  websiteUrl: string | null;
  primaryUserName: string | null;
  primaryUserEmail: string | null;
  openRequests: number;
  totalRequests: number;
  lastActivityAt: Date | null;
  createdAt: Date;
};

/**
 * Patient list for the staff portfolio page. One row per client with the
 * primary contact, request counts, and (for founders) live MRR.
 *
 * Optional filters: q (name ILIKE), status. Default sort is name; pass
 * sort: "mrr" or "recent" to override.
 */
export async function listAllClientsForStaff(opts?: {
  q?: string;
  status?: "active" | "lead" | "discharged" | "all";
  sort?: "name" | "mrr" | "recent";
}): Promise<ClientListRow[]> {
  await requireStaff();

  const filters = [];
  const term = opts?.q?.trim();
  if (term) filters.push(ilike(clients.name, `%${term}%`));
  if (opts?.status && opts.status !== "all") {
    filters.push(eq(clients.status, opts.status));
  }

  const rows = await db()
    .select({
      id: clients.id,
      name: clients.name,
      plan: clients.plan,
      status: clients.status,
      mrrCents: clients.mrrCents,
      websiteUrl: clients.websiteUrl,
      primaryUserName: users.name,
      primaryUserEmail: users.email,
      createdAt: clients.createdAt,
      openRequests: sql<number>`(
        select count(*)::int from request
        where request.client_id = ${clients.id}
        and request.status not in ('healed','closed')
      )`,
      totalRequests: sql<number>`(
        select count(*)::int from request
        where request.client_id = ${clients.id}
      )`,
      lastActivityAt: sql<Date | null>`(
        select max(updated_at) from request
        where request.client_id = ${clients.id}
      )`,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.primaryUserId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(
      opts?.sort === "mrr"
        ? desc(clients.mrrCents)
        : opts?.sort === "recent"
          ? desc(clients.updatedAt)
          : clients.name
    );

  return rows.map((r) => ({
    ...r,
    lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt) : null,
    createdAt: new Date(r.createdAt),
  }));
}

export async function clientCountsByStatus(): Promise<{
  active: number;
  lead: number;
  discharged: number;
  total: number;
}> {
  await requireStaff();
  const rows = await db()
    .select({
      status: clients.status,
      n: sql<number>`count(*)::int`,
    })
    .from(clients)
    .groupBy(clients.status);
  const out = { active: 0, lead: 0, discharged: 0, total: 0 };
  for (const r of rows) {
    if (r.status === "active") out.active = r.n;
    else if (r.status === "lead") out.lead = r.n;
    else if (r.status === "discharged") out.discharged = r.n;
    out.total += r.n;
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────
   Detail page
   ──────────────────────────────────────────────────────────────────────── */

export type ClientDetail = {
  client: Client;
  primaryUser: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  leadDoctor: {
    id: string;
    name: string | null;
  } | null;
  members: {
    userId: string;
    name: string | null;
    email: string | null;
    isAdmin: boolean;
    joinedAt: Date;
  }[];
  recentRequests: {
    id: string;
    title: string;
    status: string;
    priority: string;
    type: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  totalRequests: number;
  openRequests: number;
  latestCheck: {
    ok: boolean;
    statusCode: number | null;
    responseTimeMs: number | null;
    error: string | null;
    checkedAt: Date;
  } | null;
};

export async function getClientForStaff(clientId: string): Promise<ClientDetail | null> {
  await requireStaff();

  const cRows = await db()
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (cRows.length === 0) return null;
  const client = cRows[0];

  // Primary contact
  let primaryUser: ClientDetail["primaryUser"] = null;
  if (client.primaryUserId) {
    const u = await db()
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, client.primaryUserId))
      .limit(1);
    primaryUser = u[0] ?? null;
  }

  // Lead doctor
  let leadDoctor: ClientDetail["leadDoctor"] = null;
  if (client.leadDoctorId) {
    const u = await db()
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, client.leadDoctorId))
      .limit(1);
    leadDoctor = u[0] ?? null;
  }

  // Members
  const memberRows = await db()
    .select({
      userId: clientMembers.userId,
      isAdmin: clientMembers.isAdmin,
      joinedAt: clientMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(clientMembers)
    .leftJoin(users, eq(users.id, clientMembers.userId))
    .where(eq(clientMembers.clientId, clientId));

  // Recent requests
  const reqRows = await db()
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      priority: requests.priority,
      type: requests.type,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
    })
    .from(requests)
    .where(eq(requests.clientId, clientId))
    .orderBy(desc(requests.updatedAt))
    .limit(20);

  // Counts
  const counts = await db()
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`count(*) filter (where status not in ('healed','closed'))::int`,
    })
    .from(requests)
    .where(eq(requests.clientId, clientId));

  // Latest health check
  let latestCheck: ClientDetail["latestCheck"] = null;
  if (client.websiteUrl) {
    const c = await db()
      .select({
        ok: healthChecks.ok,
        statusCode: healthChecks.statusCode,
        responseTimeMs: healthChecks.responseTimeMs,
        error: healthChecks.error,
        checkedAt: healthChecks.checkedAt,
      })
      .from(healthChecks)
      .where(eq(healthChecks.clientId, clientId))
      .orderBy(desc(healthChecks.checkedAt))
      .limit(1);
    latestCheck = c[0]
      ? { ...c[0], checkedAt: new Date(c[0].checkedAt) }
      : null;
  }

  return {
    client,
    primaryUser,
    leadDoctor,
    members: memberRows.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      isAdmin: m.isAdmin,
      joinedAt: new Date(m.joinedAt),
    })),
    recentRequests: reqRows.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    })),
    totalRequests: counts[0]?.total ?? 0,
    openRequests: counts[0]?.open ?? 0,
    latestCheck,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Mutations
   ──────────────────────────────────────────────────────────────────────── */

const ALLOWED_PLANS = new Set(["checkup", "general", "premium"]);
const ALLOWED_STATUSES = new Set(["active", "lead", "discharged"]);

/**
 * Update an existing client. Founder-only fields (plan, status, MRR) are
 * silently ignored when the caller isn't a founder. Non-financial fields
 * (website, notes, lead doctor) are open to any staff role.
 */
export async function updateClient(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const isFounder = session.user.role === "founder";
  const updates: Partial<{
    name: string;
    websiteUrl: string | null;
    plan: "checkup" | "general" | "premium";
    status: "active" | "lead" | "discharged";
    mrrCents: number;
    notes: string | null;
    leadDoctorId: string | null;
    updatedAt: Date;
  }> = {};

  // Any staff can edit these
  const name = String(formData.get("name") ?? "").trim();
  if (name) updates.name = name.slice(0, 200);

  const url = String(formData.get("websiteUrl") ?? "").trim();
  if (url === "") {
    updates.websiteUrl = null;
  } else {
    const normalized = normalizeWebsiteUrl(url);
    if (normalized) updates.websiteUrl = normalized;
    // Otherwise keep the current value rather than nuking it on bad input
  }

  const notes = String(formData.get("notes") ?? "");
  if (notes !== "") updates.notes = notes.slice(0, 2000);

  const leadDoctorId = String(formData.get("leadDoctorId") ?? "");
  if (leadDoctorId === "__none__") updates.leadDoctorId = null;
  else if (leadDoctorId) updates.leadDoctorId = leadDoctorId;

  // Founder-only
  if (isFounder) {
    const plan = String(formData.get("plan") ?? "");
    if (ALLOWED_PLANS.has(plan)) {
      updates.plan = plan as "checkup" | "general" | "premium";
    }
    const status = String(formData.get("status") ?? "");
    if (ALLOWED_STATUSES.has(status)) {
      updates.status = status as "active" | "lead" | "discharged";
    }
    const mrrRaw = String(formData.get("mrrDollars") ?? "");
    const mrrDollars = parseFloat(mrrRaw);
    if (Number.isFinite(mrrDollars) && mrrDollars >= 0) {
      updates.mrrCents = Math.round(mrrDollars * 100);
    }
  }

  if (Object.keys(updates).length === 0) return;
  updates.updatedAt = new Date();

  // Read previous values for the audit log so we record a real diff
  const before = await db()
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (before.length === 0) return;

  await db().update(clients).set(updates).where(eq(clients.id, clientId));

  // Diff for audit
  const diffBefore: Record<string, unknown> = {};
  const diffAfter: Record<string, unknown> = {};
  for (const k of Object.keys(updates) as (keyof typeof updates)[]) {
    if (k === "updatedAt") continue;
    diffBefore[k] = (before[0] as unknown as Record<string, unknown>)[k];
    diffAfter[k] = (updates as Record<string, unknown>)[k];
  }
  await recordAudit({
    actorUserId: session.user.id,
    action: "client.update",
    targetType: "client",
    targetId: clientId,
    before: diffBefore,
    after: diffAfter,
  });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
  revalidatePath("/admin");
}

/** Returns the staff users available as a "lead doctor" pick. Used only to
 *  populate the dropdown on the client detail edit form. */
export async function listStaffForPicker(): Promise<
  { id: string; name: string | null; email: string | null }[]
> {
  const session = await requireStaff();
  if (!isStaff(session.user.role)) return [];
  const rows = await db()
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`${users.role} <> 'client'`)
    .orderBy(users.name);
  return rows;
}
