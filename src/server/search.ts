"use server";

import { db, requests, clients } from "@/db";
import { eq, and, ilike, desc, or, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { isStaff } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import { listArticles } from "@/content/knowledge";

/**
 * Cross-resource portal search.
 *
 * Patient role  → their own (non-archived) requests + knowledge articles.
 * Staff role    → all clients (patients) + all requests + knowledge articles.
 *
 * Returns grouped results so the client can render section headers
 * without inferring types from result shape. Capped per-group so a
 * common term can't pull thousands of rows over the wire — the user
 * narrows further by typing.
 */

export type SearchHit =
  | {
      kind: "request";
      id: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "patient";
      id: string;
      title: string;
      subtitle: string;
      href: string;
    }
  | {
      kind: "knowledge";
      slug: string;
      title: string;
      subtitle: string;
      href: string;
    };

export type SearchResults = {
  requests: SearchHit[];
  patients: SearchHit[];
  knowledge: SearchHit[];
  /** Total across all groups — convenient for "no results" UX. */
  total: number;
};

const PER_GROUP = 6;
const MIN_QUERY = 2;

export async function searchPortal(rawQuery: string): Promise<SearchResults> {
  const empty: SearchResults = {
    requests: [],
    patients: [],
    knowledge: [],
    total: 0,
  };

  const q = rawQuery.trim();
  if (q.length < MIN_QUERY) return empty;

  const session = await auth();
  if (!session?.user) return empty;
  const staff = isStaff(session.user.role);
  const pattern = `%${q}%`;

  // Knowledge — file-based, do it in JS. Tiny set, so substring on title +
  // summary + tags is fine.
  const articles = listArticles();
  const ql = q.toLowerCase();
  const knowledge: SearchHit[] = articles
    .filter((a) => {
      const hay = (a.title + " " + a.summary + " " + a.tags.join(" ")).toLowerCase();
      return hay.includes(ql);
    })
    .slice(0, PER_GROUP)
    .map((a) => ({
      kind: "knowledge" as const,
      slug: a.slug,
      title: a.title,
      subtitle: a.summary,
      href: `/knowledge/${a.slug}`,
    }));

  if (staff) {
    // Staff: all requests + all clients (patients).
    const [reqRows, clientRows] = await Promise.all([
      db()
        .select({
          id: requests.id,
          title: requests.title,
          status: requests.status,
          clientName: clients.name,
        })
        .from(requests)
        .leftJoin(clients, eq(clients.id, requests.clientId))
        .where(
          and(
            isNull(requests.archivedAt),
            or(
              ilike(requests.title, pattern),
              ilike(requests.description, pattern)
            )
          )
        )
        .orderBy(desc(requests.updatedAt))
        .limit(PER_GROUP),
      db()
        .select({
          id: clients.id,
          name: clients.name,
          plan: clients.plan,
          status: clients.status,
        })
        .from(clients)
        .where(ilike(clients.name, pattern))
        .orderBy(clients.name)
        .limit(PER_GROUP),
    ]);

    const requestHits: SearchHit[] = reqRows.map((r) => ({
      kind: "request",
      id: r.id,
      title: r.title,
      subtitle: r.clientName
        ? `${r.clientName} · ${prettyStatus(r.status)}`
        : prettyStatus(r.status),
      href: `/requests/${r.id}`,
    }));

    const patientHits: SearchHit[] = clientRows.map((c) => ({
      kind: "patient",
      id: c.id,
      title: c.name,
      subtitle: `${prettyPlan(c.plan)} · ${prettyClientStatus(c.status)}`,
      href: `/clients/${c.id}`,
    }));

    return {
      requests: requestHits,
      patients: patientHits,
      knowledge,
      total: requestHits.length + patientHits.length + knowledge.length,
    };
  }

  // Patient: only their own non-archived requests.
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const reqRows = await db()
    .select({
      id: requests.id,
      title: requests.title,
      status: requests.status,
      type: requests.type,
    })
    .from(requests)
    .where(
      and(
        eq(requests.clientId, client.id),
        isNull(requests.archivedAt),
        or(
          ilike(requests.title, pattern),
          ilike(requests.description, pattern)
        )
      )
    )
    .orderBy(desc(requests.updatedAt))
    .limit(PER_GROUP);

  const requestHits: SearchHit[] = reqRows.map((r) => ({
    kind: "request",
    id: r.id,
    title: r.title,
    subtitle: prettyStatus(r.status),
    href: `/requests/${r.id}`,
  }));

  return {
    requests: requestHits,
    patients: [],
    knowledge,
    total: requestHits.length + knowledge.length,
  };
}

/* ──────────────────────────────────────────────────────────────────────── */

function prettyStatus(status: string): string {
  const map: Record<string, string> = {
    triaged: "Triaged",
    diagnosed: "Diagnosed",
    in_treatment: "In treatment",
    in_review: "In review",
    healed: "Healed",
    closed: "Closed",
  };
  return map[status] ?? status;
}

function prettyClientStatus(status: string): string {
  const map: Record<string, string> = {
    lead: "Lead",
    active: "Active",
    paused: "Paused",
    discharged: "Discharged",
  };
  return map[status] ?? status;
}

function prettyPlan(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return plan;
}
