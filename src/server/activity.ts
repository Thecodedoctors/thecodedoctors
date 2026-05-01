import {
  db,
  requests,
  messages,
  scans,
  clients,
  users,
} from "@/db";
import { eq, desc, and, sql, inArray, ne } from "drizzle-orm";
import { requireUser, isStaff } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";

export type ActivityItem = {
  id: string;
  kind: "request_created" | "message_received" | "message_sent" | "status_changed";
  requestId: string;
  requestTitle: string;
  authorName: string | null;
  body?: string;
  ts: Date;
};

/**
 * Build an activity feed for the current client user — recent messages on
 * their own requests + recent request creations, top N, newest first.
 */
export async function activityForCurrentUser(limit = 10): Promise<ActivityItem[]> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  // Pull request IDs for the user's client first.
  const clientRequests = await db()
    .select({ id: requests.id, title: requests.title, createdAt: requests.createdAt })
    .from(requests)
    .where(eq(requests.clientId, client.id))
    .orderBy(desc(requests.createdAt))
    .limit(limit * 2);

  if (clientRequests.length === 0) return [];

  const idList = clientRequests.map((r) => r.id);

  const recentMessages = await db()
    .select({
      id: messages.id,
      requestId: messages.requestId,
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
    .where(
      and(
        inArray(messages.requestId, idList),
        eq(messages.internal, false) // never expose staff-internal notes to clients
      )
    )
    .orderBy(desc(messages.createdAt))
    .limit(limit * 2);

  const titleById = new Map(clientRequests.map((r) => [r.id, r.title]));

  const items: ActivityItem[] = [];

  for (const r of clientRequests) {
    items.push({
      id: `req-${r.id}`,
      kind: "request_created",
      requestId: r.id,
      requestTitle: r.title,
      authorName: session.user.name ?? null,
      ts: new Date(r.createdAt),
    });
  }

  for (const m of recentMessages) {
    const isMine = m.authorId === session.user.id;
    items.push({
      id: `msg-${m.id}`,
      kind: isMine ? "message_sent" : "message_received",
      requestId: m.requestId,
      requestTitle: titleById.get(m.requestId) ?? "request",
      authorName: m.authorName ?? m.authorEmail ?? null,
      body: m.body.slice(0, 160),
      ts: new Date(m.createdAt),
    });
  }

  items.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  return items.slice(0, limit);
}

/**
 * Latest scan score (if any) we have for this user's client. Used in the
 * dashboard's site-health card. Returns null when no scans exist yet.
 */
export async function latestScanForCurrentUser(): Promise<{
  url: string;
  overallScore: number;
  overallGrade: string;
  scannedAt: Date;
} | null> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const rows = await db()
    .select({
      finalUrl: scans.finalUrl,
      overallScore: scans.overallScore,
      overallGrade: scans.overallGrade,
      scannedAt: scans.scannedAt,
    })
    .from(scans)
    .where(eq(scans.clientId, client.id))
    .orderBy(desc(scans.scannedAt))
    .limit(1);

  if (rows.length === 0) return null;
  return {
    url: rows[0].finalUrl,
    overallScore: rows[0].overallScore,
    overallGrade: rows[0].overallGrade,
    scannedAt: new Date(rows[0].scannedAt),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff
   ──────────────────────────────────────────────────────────────────────── */

export async function activityForStaff(limit = 12): Promise<
  Array<
    ActivityItem & {
      clientName: string | null;
    }
  >
> {
  const session = await requireUser();
  if (!isStaff(session.user.role)) return [];

  const recentMessages = await db()
    .select({
      id: messages.id,
      requestId: messages.requestId,
      body: messages.body,
      internal: messages.internal,
      createdAt: messages.createdAt,
      authorId: messages.authorUserId,
      authorName: users.name,
      authorEmail: users.email,
      authorRole: users.role,
      requestTitle: requests.title,
      clientName: clients.name,
    })
    .from(messages)
    .innerJoin(requests, eq(requests.id, messages.requestId))
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .leftJoin(users, eq(users.id, messages.authorUserId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return recentMessages.map((m) => {
    const isStaffMsg = isStaff(m.authorRole ?? undefined);
    return {
      id: `msg-${m.id}`,
      kind: isStaffMsg ? "message_sent" : "message_received",
      requestId: m.requestId,
      requestTitle: m.requestTitle,
      authorName: m.authorName ?? m.authorEmail ?? null,
      body: m.body.slice(0, 160),
      ts: new Date(m.createdAt),
      clientName: m.clientName,
    } as ActivityItem & { clientName: string | null };
  });
}

export async function clientPortfolioForStaff(limit = 5) {
  const session = await requireUser();
  if (!isStaff(session.user.role)) return [];

  const rows = await db()
    .select({
      id: clients.id,
      name: clients.name,
      plan: clients.plan,
      status: clients.status,
      mrrCents: clients.mrrCents,
      websiteUrl: clients.websiteUrl,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(ne(clients.status, "discharged"))
    .orderBy(desc(clients.createdAt))
    .limit(limit);

  return rows;
}

/* Suppress unused-import warning when sql is exported from drizzle */
void sql;
