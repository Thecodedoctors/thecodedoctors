import { db, clients, users } from "@/db";
import { eq, sql, and, ilike, desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";

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
