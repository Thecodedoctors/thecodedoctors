"use server";

import { db, monthlyReports, clients, users } from "@/db";
import { eq, desc, isNotNull, and, sql, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, requireStaff } from "@/lib/auth-helpers";
import { getOrCreateClientForUser } from "@/lib/clients";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { recordAudit } from "@/server/audit";

/**
 * Per-patient monthly report — drafted by a doctor on `/admin/reports`,
 * published when ready (which freezes it and emails the patient), then
 * visible to the patient on `/dashboard/reports`.
 *
 * Reminders: any active patient that hasn't received a published report
 * in 25+ days surfaces in the admin reports overview as "due soon"; 30+
 * days as "overdue."
 */

const MAX_TITLE = 200;
const MAX_BODY = 30_000;
const REMIND_DAYS = 25;
const OVERDUE_DAYS = 30;

/* ──────────────────────────────────────────────────────────────────────────
   Patient surface
   ──────────────────────────────────────────────────────────────────────── */

export async function listPublishedReportsForCurrentUser(): Promise<
  {
    id: string;
    title: string;
    publishedAt: Date;
    periodStart: Date;
    periodEnd: Date;
    authorName: string | null;
  }[]
> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const rows = await db()
    .select({
      id: monthlyReports.id,
      title: monthlyReports.title,
      publishedAt: monthlyReports.publishedAt,
      periodStart: monthlyReports.periodStart,
      periodEnd: monthlyReports.periodEnd,
      authorName: users.name,
    })
    .from(monthlyReports)
    .leftJoin(users, eq(users.id, monthlyReports.authorUserId))
    .where(
      and(
        eq(monthlyReports.clientId, client.id),
        isNotNull(monthlyReports.publishedAt)
      )
    )
    .orderBy(desc(monthlyReports.publishedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title || labelForPeriod(new Date(r.periodStart)),
    publishedAt: new Date(r.publishedAt!),
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
    authorName: r.authorName,
  }));
}

export async function getPublishedReportForCurrentUser(reportId: string): Promise<{
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  authorName: string | null;
} | null> {
  const session = await requireUser();
  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  const rows = await db()
    .select({
      id: monthlyReports.id,
      clientId: monthlyReports.clientId,
      title: monthlyReports.title,
      body: monthlyReports.body,
      publishedAt: monthlyReports.publishedAt,
      periodStart: monthlyReports.periodStart,
      periodEnd: monthlyReports.periodEnd,
      authorName: users.name,
    })
    .from(monthlyReports)
    .leftJoin(users, eq(users.id, monthlyReports.authorUserId))
    .where(eq(monthlyReports.id, reportId))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  if (r.clientId !== client.id) return null;
  if (!r.publishedAt) return null;
  return {
    id: r.id,
    title: r.title || labelForPeriod(new Date(r.periodStart)),
    body: r.body,
    publishedAt: new Date(r.publishedAt),
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
    authorName: r.authorName,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff surface — overview
   ──────────────────────────────────────────────────────────────────────── */

export type ReportStatusRow = {
  clientId: string;
  clientName: string;
  lastPublishedAt: Date | null;
  daysSinceLast: number | null;
  state: "ok" | "due_soon" | "overdue" | "never";
};

/** Per-client status for the admin reports landing. Pulls one row per
 *  active patient with the most recent publish date so the doctor can
 *  see who's overdue at a glance. */
export async function reportStatusByClient(): Promise<ReportStatusRow[]> {
  await requireStaff();
  const rows = await db()
    .select({
      clientId: clients.id,
      clientName: clients.name,
      lastPublishedAt: sql<Date | null>`max(${monthlyReports.publishedAt})`,
    })
    .from(clients)
    .leftJoin(monthlyReports, eq(monthlyReports.clientId, clients.id))
    .where(eq(clients.status, "active"))
    .groupBy(clients.id, clients.name)
    .orderBy(clients.name);

  const now = Date.now();
  return rows.map((r) => {
    const last = r.lastPublishedAt ? new Date(r.lastPublishedAt) : null;
    if (!last) {
      return {
        clientId: r.clientId,
        clientName: r.clientName,
        lastPublishedAt: null,
        daysSinceLast: null,
        state: "never" as const,
      };
    }
    const days = Math.floor((now - last.getTime()) / 86400_000);
    const state: ReportStatusRow["state"] =
      days >= OVERDUE_DAYS
        ? "overdue"
        : days >= REMIND_DAYS
          ? "due_soon"
          : "ok";
    return {
      clientId: r.clientId,
      clientName: r.clientName,
      lastPublishedAt: last,
      daysSinceLast: days,
      state,
    };
  });
}

/** Reports for a single patient — admin view, includes drafts. */
export async function listReportsForClientAdmin(clientId: string): Promise<
  {
    id: string;
    title: string;
    publishedAt: Date | null;
    periodStart: Date;
    periodEnd: Date;
    authorName: string | null;
    updatedAt: Date;
  }[]
> {
  await requireStaff();
  const rows = await db()
    .select({
      id: monthlyReports.id,
      title: monthlyReports.title,
      publishedAt: monthlyReports.publishedAt,
      periodStart: monthlyReports.periodStart,
      periodEnd: monthlyReports.periodEnd,
      updatedAt: monthlyReports.updatedAt,
      authorName: users.name,
    })
    .from(monthlyReports)
    .leftJoin(users, eq(users.id, monthlyReports.authorUserId))
    .where(eq(monthlyReports.clientId, clientId))
    .orderBy(desc(monthlyReports.periodStart));

  return rows.map((r) => ({
    id: r.id,
    title: r.title || labelForPeriod(new Date(r.periodStart)),
    publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
    authorName: r.authorName,
    updatedAt: new Date(r.updatedAt),
  }));
}

/** Single report for the admin editor — includes draft state. */
export async function getReportForStaff(reportId: string): Promise<{
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  body: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date | null;
  authorName: string | null;
} | null> {
  await requireStaff();
  const rows = await db()
    .select({
      id: monthlyReports.id,
      clientId: monthlyReports.clientId,
      clientName: clients.name,
      title: monthlyReports.title,
      body: monthlyReports.body,
      periodStart: monthlyReports.periodStart,
      periodEnd: monthlyReports.periodEnd,
      publishedAt: monthlyReports.publishedAt,
      authorName: users.name,
    })
    .from(monthlyReports)
    .leftJoin(clients, eq(clients.id, monthlyReports.clientId))
    .leftJoin(users, eq(users.id, monthlyReports.authorUserId))
    .where(eq(monthlyReports.id, reportId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    clientId: r.clientId,
    clientName: r.clientName ?? "(unknown)",
    title: r.title,
    body: r.body,
    periodStart: new Date(r.periodStart),
    periodEnd: new Date(r.periodEnd),
    publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
    authorName: r.authorName,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff actions
   ──────────────────────────────────────────────────────────────────────── */

/** Form action — creates a fresh draft for the given patient covering
 *  the previous calendar month, then redirects to the editor. */
export async function startNewReport(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const { start, end } = previousMonthRange();

  const id = crypto.randomUUID();
  await db().insert(monthlyReports).values({
    id,
    clientId,
    authorUserId: session.user.id,
    periodStart: start,
    periodEnd: end,
    title: "",
    body: "",
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "report.draft_created",
    targetType: "client",
    targetId: clientId,
    after: { reportId: id, periodStart: start.toISOString(), periodEnd: end.toISOString() },
  });

  redirect(`/admin/reports/${clientId}/edit/${id}`);
}

/** Form action — saves draft body/title. */
export async function saveReportDraft(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) return;
  const title = String(formData.get("title") ?? "").slice(0, MAX_TITLE);
  const body = String(formData.get("body") ?? "").slice(0, MAX_BODY);

  // Lock the body of an already-published report (the patient may
  // have read it; mutating after-the-fact is misleading).
  const existing = await db()
    .select({ publishedAt: monthlyReports.publishedAt })
    .from(monthlyReports)
    .where(eq(monthlyReports.id, reportId))
    .limit(1);
  if (existing.length === 0) return;
  if (existing[0].publishedAt) return;

  await db()
    .update(monthlyReports)
    .set({ title, body, updatedAt: new Date() })
    .where(eq(monthlyReports.id, reportId));

  await recordAudit({
    actorUserId: session.user.id,
    action: "report.draft_saved",
    targetType: "report",
    targetId: reportId,
  });

  revalidatePath(`/admin/reports/${reportId}`);
}

/** Form action — publishes a draft, freezing the body and emailing the
 *  patient's primary contact with a link to view it. */
export async function publishReport(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const reportId = String(formData.get("reportId") ?? "");
  const title = String(formData.get("title") ?? "").slice(0, MAX_TITLE);
  const body = String(formData.get("body") ?? "").slice(0, MAX_BODY);
  if (!reportId) return;

  // Save the latest text + flip publishedAt in one go.
  const existing = await db()
    .select({
      id: monthlyReports.id,
      clientId: monthlyReports.clientId,
      publishedAt: monthlyReports.publishedAt,
      periodStart: monthlyReports.periodStart,
      periodEnd: monthlyReports.periodEnd,
    })
    .from(monthlyReports)
    .where(eq(monthlyReports.id, reportId))
    .limit(1);
  if (existing.length === 0) return;
  if (existing[0].publishedAt) return; // idempotent — already published

  const now = new Date();
  await db()
    .update(monthlyReports)
    .set({ title, body, publishedAt: now, updatedAt: now })
    .where(eq(monthlyReports.id, reportId));

  const clientId = existing[0].clientId;

  await recordAudit({
    actorUserId: session.user.id,
    action: "report.publish",
    targetType: "report",
    targetId: reportId,
    after: { clientId },
  });

  // Email the primary contact.
  await emailReportToClient({
    reportId,
    clientId,
    title: title || labelForPeriod(new Date(existing[0].periodStart)),
  });

  revalidatePath(`/admin/reports/${clientId}/edit/${reportId}`);
  revalidatePath(`/admin/reports/${clientId}`);
  revalidatePath("/admin/reports");
  redirect(`/admin/reports/${clientId}/edit/${reportId}?published=1`);
}

/** Form action — deletes a draft (only drafts; published reports
 *  stay on the medical record). */
export async function deleteReportDraft(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const reportId = String(formData.get("reportId") ?? "");
  if (!reportId) return;
  const existing = await db()
    .select({
      publishedAt: monthlyReports.publishedAt,
      clientId: monthlyReports.clientId,
    })
    .from(monthlyReports)
    .where(eq(monthlyReports.id, reportId))
    .limit(1);
  if (existing.length === 0) return;
  if (existing[0].publishedAt) return; // never delete published

  await db().delete(monthlyReports).where(eq(monthlyReports.id, reportId));
  await recordAudit({
    actorUserId: session.user.id,
    action: "report.draft_deleted",
    targetType: "report",
    targetId: reportId,
  });

  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${existing[0].clientId}`);
  redirect(`/admin/reports`);
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────────── */

void isNull; // kept for future "draft only" filter

function previousMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { start, end };
}

export function labelForPeriod(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

async function emailReportToClient({
  reportId,
  clientId,
  title,
}: {
  reportId: string;
  clientId: string;
  title: string;
}) {
  const rows = await db()
    .select({
      orgName: clients.name,
      contactEmail: users.email,
      contactName: users.name,
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.primaryUserId))
    .where(eq(clients.id, clientId))
    .limit(1);
  const r = rows[0];
  if (!r?.contactEmail) return;

  try {
    await sendBrandEmail({
      to: r.contactEmail,
      subject: `Your ${title} report — ${r.orgName ?? site.name}`,
      html: renderReportEmail({
        title,
        orgName: r.orgName ?? "your site",
        contactName: r.contactName,
        reportId,
      }),
    });
  } catch (err) {
    console.error("[reports] publish email failed", err);
  }
}

function renderReportEmail({
  title,
  orgName,
  contactName,
  reportId,
}: {
  title: string;
  orgName: string;
  contactName: string | null;
  reportId: string;
}): string {
  const greeting = contactName ? `Hi ${escapeHtml(contactName)}.` : "Hi.";
  const link = `https://app.thecodedoctors.com/reports/${reportId}`;
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:#0A0E13;color:#F2F4F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px;">
    <p style="color:#3DD9D6;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 24px 0;">${site.name}</p>
    <h1 style="font-size:28px;font-weight:600;letter-spacing:-0.02em;margin:0 0 16px 0;">${greeting}</h1>
    <p style="margin:0 0 16px 0;">
      Your ${escapeHtml(title)} report for ${escapeHtml(orgName)} is ready.
      It covers what we treated this period, what's healthy, and what we
      recommend next.
    </p>
    <p style="margin:24px 0;">
      <a href="${link}"
         style="display:inline-block;background:#3DD9D6;color:#0A0E13;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">
        Open the report
      </a>
    </p>
    <p style="margin:0;color:#9AA4B2;font-size:13px;">
      You'll always find past reports under
      <span style="color:#F2F4F7;font-family:ui-monospace,monospace;">Reports</span>
      in your patient portal.
    </p>
    <p style="margin:32px 0 0 0;color:#9AA4B2;font-size:11px;">${site.name} · ${site.url}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
