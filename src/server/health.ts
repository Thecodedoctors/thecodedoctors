"use server";

import {
  db,
  clients,
  healthChecks,
  type NewHealthCheck,
} from "@/db";
import { eq, desc, and, gt, sql, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser, requireStaff } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import { dispatchEvent, staffUserIds } from "@/server/notifications";
import {
  emailSiteWentDown,
  emailSiteRecovered,
} from "@/lib/email-templates";

const CHECK_TIMEOUT_MS = 10_000;
const USER_AGENT =
  "TheCodeDoctors-Uptime/0.1 (+https://thecodedoctors.com/security)";

/* ──────────────────────────────────────────────────────────────────────────
   Internal: perform one HTTP check + persist + flip-detection.
   ──────────────────────────────────────────────────────────────────────── */

async function performCheck(clientId: string, url: string) {
  const start = Date.now();
  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;
  let responseTimeMs = 0;

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    statusCode = res.status;
    responseTimeMs = Date.now() - start;
    ok = res.status >= 200 && res.status < 400;
    if (!ok) error = `HTTP ${res.status}`;
    // Drain response so the connection can be reused.
    try {
      await res.body?.cancel();
    } catch {
      /* noop */
    }
  } catch (err) {
    responseTimeMs = Date.now() - start;
    if (err instanceof Error) {
      error =
        err.name === "TimeoutError"
          ? `Timeout (>${CHECK_TIMEOUT_MS}ms)`
          : err.message.slice(0, 200);
    } else {
      error = "Unknown fetch error";
    }
  }

  return { ok, statusCode, responseTimeMs, error };
}

/**
 * Record a check + fire flip notifications if the up/down state changed
 * from the previous check.
 */
async function recordCheck(clientId: string, url: string, clientName?: string) {
  // 1. Find the previous check for this client to detect a flip.
  const prev = await db()
    .select({ ok: healthChecks.ok })
    .from(healthChecks)
    .where(eq(healthChecks.clientId, clientId))
    .orderBy(desc(healthChecks.checkedAt))
    .limit(1);
  const wasOk = prev[0]?.ok ?? null; // null when this is the first-ever check

  // 2. Perform the check.
  const result = await performCheck(clientId, url);

  // 3. Persist.
  const row: NewHealthCheck = {
    clientId,
    url,
    ok: result.ok,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
  };
  await db().insert(healthChecks).values(row);

  // 4. Fire flip notifications. Only on a state change — never every tick.
  if (wasOk === null) return result; // first check, no prior state to compare
  if (wasOk === result.ok) return result; // no change

  const staff = await staffUserIds();
  const displayName = clientName ?? "client";
  if (!result.ok) {
    // Up → Down
    await dispatchEvent({
      recipients: staff,
      eventKey: "site.went_down",
      title: `Site down · ${displayName}`,
      body: `${url} is unreachable${result.error ? ` (${result.error})` : ""}`,
      href: "/fleet",
      targetType: "client",
      targetId: clientId,
      email: emailSiteWentDown({
        clientName: displayName,
        url,
        error: result.error,
      }),
    });
  } else {
    // Down → Up
    await dispatchEvent({
      recipients: staff,
      eventKey: "site.recovered",
      title: `Site back up · ${displayName}`,
      body: `${url} is responding again (${result.responseTimeMs}ms)`,
      href: "/fleet",
      targetType: "client",
      targetId: clientId,
      email: emailSiteRecovered({
        clientName: displayName,
        url,
        responseMs: result.responseTimeMs,
      }),
    });
  }

  return result;
}

/* ──────────────────────────────────────────────────────────────────────────
   Public — patient side
   ──────────────────────────────────────────────────────────────────────── */

export type LatestCheck = {
  url: string;
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number | null;
  error: string | null;
  checkedAt: Date;
} | null;

/**
 * Most recent uptime check for a single client. Null if no checks yet.
 */
export async function latestCheckForClient(
  clientId: string
): Promise<LatestCheck> {
  const rows = await db()
    .select({
      url: healthChecks.url,
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
  return rows[0] ?? null;
}

/**
 * Uptime stats over the last `windowMs` window for a single client.
 * Returns success ratio + counts. Used for the dashboard widget.
 */
export async function uptimeStatsForClient(
  clientId: string,
  windowMs = 30 * 24 * 60 * 60 * 1000 // 30 days
) {
  const since = new Date(Date.now() - windowMs);
  const rows = await db()
    .select({
      total: sql<number>`count(*)::int`,
      up: sql<number>`sum(case when ${healthChecks.ok} then 1 else 0 end)::int`,
      avgResponseMs: sql<number>`coalesce(avg(${healthChecks.responseTimeMs})::int, 0)`,
    })
    .from(healthChecks)
    .where(
      and(
        eq(healthChecks.clientId, clientId),
        gt(healthChecks.checkedAt, since)
      )
    );
  const total = rows[0]?.total ?? 0;
  const up = rows[0]?.up ?? 0;
  return {
    total,
    up,
    down: total - up,
    uptimeRatio: total > 0 ? up / total : null,
    avgResponseMs: rows[0]?.avgResponseMs ?? 0,
  };
}

/**
 * Patient-side server action: trigger a manual uptime check for the
 * caller's client. Useful when the patient just put their site back up
 * and wants a fresh status without waiting for the cron.
 */
export async function checkMySiteNow(): Promise<void> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });
  if (!client.websiteUrl) return;
  await recordCheck(client.id, client.websiteUrl, client.name);
  revalidatePath("/dashboard");
}

/**
 * Set the client's website URL. Used by the patient to configure
 * monitoring inline from the dashboard, until Phase 4 onboarding
 * captures it at sign-up.
 */
export async function setMyClientWebsiteUrl(formData: FormData): Promise<void> {
  const session = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  await db()
    .update(clients)
    .set({ websiteUrl: parsed.toString(), updatedAt: new Date() })
    .where(eq(clients.id, client.id));

  // Run a first check immediately so the dashboard has data.
  try {
    await recordCheck(client.id, parsed.toString(), client.name);
  } catch (err) {
    console.error("[health] initial check after URL set failed", err);
  }

  revalidatePath("/dashboard");
}

/* ──────────────────────────────────────────────────────────────────────────
   Public — staff side
   ──────────────────────────────────────────────────────────────────────── */

export type FleetRow = {
  clientId: string;
  clientName: string;
  websiteUrl: string;
  latest: LatestCheck;
};

export async function fleetForStaff(): Promise<FleetRow[]> {
  await requireStaff();
  const all = await db()
    .select({
      id: clients.id,
      name: clients.name,
      websiteUrl: clients.websiteUrl,
    })
    .from(clients)
    .where(isNotNull(clients.websiteUrl))
    .orderBy(clients.name);

  // Pull the latest check per client. For now, one query per client —
  // fine at our scale. Window function rewrite when row count justifies.
  const result: FleetRow[] = [];
  for (const c of all) {
    if (!c.websiteUrl) continue;
    const latest = await latestCheckForClient(c.id);
    result.push({
      clientId: c.id,
      clientName: c.name,
      websiteUrl: c.websiteUrl,
      latest,
    });
  }
  return result;
}

export type FleetSummary = {
  down: number;
  healthy: number;
  unchecked: number;
  total: number;
  downSites: {
    clientId: string;
    clientName: string;
    websiteUrl: string;
    error: string | null;
    since: Date;
  }[];
};

/**
 * Aggregate fleet status for the staff home page. Down sites come back
 * with the timestamp + error of the last check so the alert strip can
 * show "down for 12m · Connection refused".
 */
export async function fleetSummaryForStaff(): Promise<FleetSummary> {
  const fleet = await fleetForStaff();
  const summary: FleetSummary = {
    down: 0,
    healthy: 0,
    unchecked: 0,
    total: fleet.length,
    downSites: [],
  };
  for (const row of fleet) {
    if (!row.latest) {
      summary.unchecked += 1;
      continue;
    }
    if (row.latest.ok) {
      summary.healthy += 1;
    } else {
      summary.down += 1;
      summary.downSites.push({
        clientId: row.clientId,
        clientName: row.clientName,
        websiteUrl: row.websiteUrl,
        error: row.latest.error,
        since: row.latest.checkedAt,
      });
    }
  }
  return summary;
}

/**
 * Run uptime checks against every client with a configured site URL.
 * Called by the cron endpoint and the staff "Run all checks now" button.
 */
export async function runChecksForAllClients(): Promise<{
  checked: number;
  failed: number;
}> {
  const all = await db()
    .select({
      id: clients.id,
      name: clients.name,
      websiteUrl: clients.websiteUrl,
    })
    .from(clients)
    .where(isNotNull(clients.websiteUrl));

  let failed = 0;
  await Promise.all(
    all.map(async (c) => {
      if (!c.websiteUrl) return;
      try {
        await recordCheck(c.id, c.websiteUrl, c.name);
      } catch (err) {
        failed++;
        console.error("[health] check failed for", c.id, err);
      }
    })
  );

  revalidatePath("/admin/fleet");
  revalidatePath("/dashboard");
  return { checked: all.length, failed };
}

/**
 * Staff-side server action triggered by the "Check now" button on a
 * specific fleet row.
 */
export async function checkOneClientNow(formData: FormData): Promise<void> {
  await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;
  const c = await db()
    .select({
      id: clients.id,
      name: clients.name,
      websiteUrl: clients.websiteUrl,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (c.length === 0 || !c[0].websiteUrl) return;
  await recordCheck(c[0].id, c[0].websiteUrl, c[0].name);
  revalidatePath("/admin/fleet");
}

