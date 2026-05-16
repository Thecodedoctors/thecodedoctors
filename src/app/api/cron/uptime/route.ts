import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { runChecksForAllClients } from "@/server/health";
import { db, rateLimitCounters } from "@/db";

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

    return NextResponse.json({
      ok: true,
      ...result,
      rateLimitPurged,
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
