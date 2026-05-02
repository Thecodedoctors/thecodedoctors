import { db, clients } from "@/db";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";

/**
 * Revenue rollup for the founder dashboard. Sums mrr_cents from active
 * clients only (leads + churned don't count toward live revenue) and
 * breaks them down by plan tier.
 *
 * Founder-only: returns null for any other role (and for unauth'd
 * callers). The caller is responsible for not rendering anything when
 * null is returned.
 */
export type RevenueRollup = {
  mrrCents: number;
  arrCents: number;
  activeClients: number;
  byPlan: {
    plan: string;
    count: number;
    mrrCents: number;
  }[];
};

export async function revenueForFounder(): Promise<RevenueRollup | null> {
  const session = await auth();
  if (session?.user?.role !== "founder") return null;

  const rows = await db()
    .select({
      plan: clients.plan,
      count: sql<number>`count(*)::int`,
      mrr: sql<number>`coalesce(sum(${clients.mrrCents})::int, 0)`,
    })
    .from(clients)
    .where(eq(clients.status, "active"))
    .groupBy(clients.plan);

  const byPlan = rows.map((r) => ({
    plan: r.plan,
    count: r.count,
    mrrCents: r.mrr,
  }));
  const mrrCents = byPlan.reduce((sum, r) => sum + r.mrrCents, 0);
  const activeClients = byPlan.reduce((sum, r) => sum + r.count, 0);

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeClients,
    byPlan,
  };
}
