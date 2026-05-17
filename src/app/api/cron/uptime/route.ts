import { NextResponse } from "next/server";
import { and, eq, isNull, isNotNull, lt } from "drizzle-orm";
import { runChecksForAllClients } from "@/server/health";
import { db, rateLimitCounters, clients } from "@/db";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron endpoint — runs an uptime check against every client's site URL.
//
// Authentication: Bearer token in the `Authorization` header. Set CRON_SECRET
// in Cloudflare worker env, then point a scheduler at this URL.
//
// Suggested cadence: every 5 minutes for v1. For 100 clients * 12 checks/hour
// over 24 hours = ~28k rows/day. Cleanup is a future maintenance task.
//
// To wire automation, either:
//   1. Cloudflare Cron Triggers (preferred long-term — set in wrangler):
//      every-5-minutes spec, then fetch this URL with the Bearer header.
//   2. cron-job.org or similar — same idea, free tier handles 5-min intervals.
//   3. Manual: any logged-in staff can trigger via the "Run all checks now"
//      button on /admin/fleet.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "cron-not-configured", message: "CRON_SECRET is not set." },
      { status: 503 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runChecksForAllClients();

    // Best-effort housekeeping: purge expired rate-limit counters so
    // that table (one row per key per window — the hottest-growth
    // table on the login/checkout path) doesn't grow without bound.
    // Never let a cleanup failure fail the uptime cron.
    let rateLimitPurged = 0;
    try {
      const deleted = await db()
        .delete(rateLimitCounters)
        .where(lt(rateLimitCounters.expiresAt, new Date()))
        .returning({ key: rateLimitCounters.key });
      rateLimitPurged = deleted.length;
    } catch (err) {
      console.error("[cron/uptime] rate-limit purge failed (non-fatal)", err);
    }

    // Billing reconciliation safety-net: a missed/late/misconfigured
    // Stripe webhook must not leave a lapsed trial with free paid
    // access forever. Targeted + bounded: only clients whose trial
    // end is in the PAST, still marked active, not cancelled, and not
    // already flagged failed — i.e. the exact "should have converted
    // but we never heard back" gap. We then ask Stripe the truth and
    // revoke when it isn't actually paying. Never fails the cron.
    let reconciled = 0;
    try {
      const stripe = getStripe();
      if (stripe) {
        const stale = await db()
          .select({
            id: clients.id,
            sub: clients.stripeSubscriptionId,
          })
          .from(clients)
          .where(
            and(
              isNotNull(clients.stripeSubscriptionId),
              eq(clients.status, "active"),
              eq(clients.cancelAtPeriodEnd, false),
              isNull(clients.paymentFailedAt),
              lt(clients.trialEndsAt, new Date())
            )
          )
          .limit(40);

        for (const c of stale) {
          if (!c.sub) continue;
          try {
            const s = await stripe.subscriptions.retrieve(c.sub);
            const dead =
              s.status === "canceled" ||
              s.status === "incomplete_expired";
            const unpaid =
              s.status === "past_due" ||
              s.status === "unpaid" ||
              s.status === "incomplete" ||
              s.status === "paused";
            if (dead) {
              await db()
                .update(clients)
                .set({
                  status: "lead",
                  mrrCents: 0,
                  paymentFailedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(clients.id, c.id));
              reconciled++;
            } else if (unpaid) {
              await db()
                .update(clients)
                .set({
                  mrrCents: 0,
                  paymentFailedAt: new Date(),
                  updatedAt: new Date(),
                })
                .where(eq(clients.id, c.id));
              reconciled++;
            }
            // active / trialing(extended) → leave; it's genuinely fine.
          } catch (err) {
            console.error(
              "[cron/uptime] reconcile: sub fetch failed (non-fatal)",
              c.id,
              err
            );
          }
        }
      }
    } catch (err) {
      console.error("[cron/uptime] reconciliation failed (non-fatal)", err);
    }

    return NextResponse.json({
      ok: true,
      ...result,
      rateLimitPurged,
      reconciled,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/uptime] failed", err);
    return NextResponse.json(
      {
        error: "cron-failed",
        message:
          err instanceof Error ? err.message.slice(0, 200) : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/** Allow plain GET for some scheduling services that only do GET. */
export const GET = POST;
