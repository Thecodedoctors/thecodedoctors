import { db, requests, clients, users } from "@/db";
import { sql, eq, and, gte, isNull, ne, desc } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";

/* ──────────────────────────────────────────────────────────────────────────
   Reports — operational rollups for the staff /admin/reports page.
   Everything here is staff-gated. Time-bucketed series use date_trunc on
   the activity column appropriate to the question.
   ──────────────────────────────────────────────────────────────────────── */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_WEEKS = 8;

export type WeekBucket = {
  /** Start of the week in UTC. */
  weekStart: Date;
  /** Human label like "Apr 22". */
  label: string;
  count: number;
};

/** Requests created per week, last N weeks. Empty weeks rendered as zero. */
export async function requestVolumeByWeek(
  weeks = DEFAULT_WEEKS
): Promise<WeekBucket[]> {
  await requireStaff();
  const since = startOfWeek(new Date(Date.now() - weeks * WEEK_MS));

  const rows = await db()
    .select({
      week: sql<Date>`date_trunc('week', ${requests.createdAt})`,
      count: sql<number>`count(*)::int`,
    })
    .from(requests)
    .where(gte(requests.createdAt, since))
    .groupBy(sql`date_trunc('week', ${requests.createdAt})`);

  return fillWeeks(rows.map((r) => ({ weekStart: new Date(r.week), count: r.count })), weeks);
}

/** Average resolution time (days) per week — averaged over requests
 *  *resolved* in that week (status = 'healed' OR 'closed'). */
export async function resolutionTimeByWeek(
  weeks = DEFAULT_WEEKS
): Promise<{ weekStart: Date; label: string; avgDays: number; n: number }[]> {
  await requireStaff();
  const since = startOfWeek(new Date(Date.now() - weeks * WEEK_MS));

  const rows = await db()
    .select({
      week: sql<Date>`date_trunc('week', ${requests.updatedAt})`,
      avgSeconds: sql<number>`coalesce(avg(extract(epoch from (${requests.updatedAt} - ${requests.createdAt})))::int, 0)`,
      n: sql<number>`count(*)::int`,
    })
    .from(requests)
    .where(
      and(
        sql`${requests.status} in ('healed','closed')`,
        gte(requests.updatedAt, since)
      )
    )
    .groupBy(sql`date_trunc('week', ${requests.updatedAt})`);

  // Build full week range, fill gaps with zeros
  const buckets = new Map<number, { avgDays: number; n: number }>();
  for (const r of rows) {
    const start = startOfWeek(new Date(r.week)).getTime();
    buckets.set(start, {
      avgDays: r.avgSeconds / (24 * 60 * 60),
      n: r.n,
    });
  }
  const out: { weekStart: Date; label: string; avgDays: number; n: number }[] = [];
  const now = startOfWeek(new Date());
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(now.getTime() - i * WEEK_MS);
    const found = buckets.get(ws.getTime());
    out.push({
      weekStart: ws,
      label: weekLabel(ws),
      avgDays: found?.avgDays ?? 0,
      n: found?.n ?? 0,
    });
  }
  return out;
}

/** Count of requests in each status (live snapshot, not historical). */
export async function statusDistribution(): Promise<
  { status: string; count: number }[]
> {
  await requireStaff();
  const rows = await db()
    .select({
      status: requests.status,
      count: sql<number>`count(*)::int`,
    })
    .from(requests)
    .where(isNull(requests.archivedAt))
    .groupBy(requests.status);
  return rows;
}

/** How patients arrived. Counts the live client roster by signup_source. */
export async function signupSourceBreakdown(): Promise<
  { source: string; count: number }[]
> {
  await requireStaff();
  const rows = await db()
    .select({
      source: sql<string>`coalesce(${clients.signupSource}, 'legacy')`,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
    .where(ne(clients.status, "discharged"))
    .groupBy(sql`coalesce(${clients.signupSource}, 'legacy')`);
  return rows;
}

/** Top patients by request activity in the last N days. */
export async function topActivePatients(
  windowDays = 30,
  limit = 5
): Promise<
  { id: string; name: string; plan: string; activityCount: number }[]
> {
  await requireStaff();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await db()
    .select({
      id: clients.id,
      name: clients.name,
      plan: clients.plan,
      activityCount: sql<number>`(
        select count(*)::int from request
        where request.client_id = ${clients.id}
        and request.updated_at >= ${since}
      )`,
    })
    .from(clients)
    .where(ne(clients.status, "discharged"))
    .orderBy(
      desc(sql`(
        select count(*) from request
        where request.client_id = ${clients.id}
        and request.updated_at >= ${since}
      )`)
    )
    .limit(limit);

  return rows.filter((r) => r.activityCount > 0);
}

/** Header stat strip — single object so the page does one fewer round-trip. */
export async function reportHeadline(): Promise<{
  totalRequests: number;
  resolvedRequests: number;
  avgResolutionDays: number | null;
  newSignupsLast30d: number;
  activeTrials: number;
}> {
  await requireStaff();
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [totals, signups, trials] = await Promise.all([
    db()
      .select({
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) filter (where status in ('healed','closed'))::int`,
        avgSec: sql<number | null>`avg(extract(epoch from (updated_at - created_at))) filter (where status in ('healed','closed'))`,
      })
      .from(requests),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(clients)
      .where(gte(clients.createdAt, since30)),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(clients)
      .where(
        and(
          eq(clients.signupSource, "trial"),
          sql`${clients.trialEndsAt} > ${now}`
        )
      ),
  ]);

  const t = totals[0];
  return {
    totalRequests: t?.total ?? 0,
    resolvedRequests: t?.resolved ?? 0,
    avgResolutionDays:
      t?.avgSec != null ? Number(t.avgSec) / (24 * 60 * 60) : null,
    newSignupsLast30d: signups[0]?.n ?? 0,
    activeTrials: trials[0]?.n ?? 0,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   helpers
   ──────────────────────────────────────────────────────────────────────── */

function startOfWeek(d: Date): Date {
  // Postgres date_trunc('week', x) returns the Monday at 00:00 UTC for x.
  // Mirror that so our zero-fill aligns with grouped rows.
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayOfWeek = x.getUTCDay(); // 0 = Sunday
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-based
  x.setUTCDate(x.getUTCDate() - offset);
  return x;
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fillWeeks(
  data: { weekStart: Date; count: number }[],
  weeks: number
): WeekBucket[] {
  const map = new Map<number, number>();
  for (const d of data) {
    map.set(startOfWeek(d.weekStart).getTime(), d.count);
  }
  const out: WeekBucket[] = [];
  const now = startOfWeek(new Date());
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(now.getTime() - i * WEEK_MS);
    out.push({
      weekStart: ws,
      label: weekLabel(ws),
      count: map.get(ws.getTime()) ?? 0,
    });
  }
  return out;
}

// Keep `users` referenced so future joins don't trip the unused-import lint.
void users;
