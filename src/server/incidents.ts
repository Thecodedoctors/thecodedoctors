"use server";

import { db, incidents } from "@/db";
import { eq, desc, isNull, gte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth-helpers";
import { recordAudit } from "@/server/audit";

/**
 * Public incidents — surfaced on /status. Doctors create, append
 * updates, and resolve them; the page just reads.
 */

const ALLOWED_SEVERITIES = new Set(["minor", "major", "critical"]);
const MAX_TITLE = 200;
const MAX_BODY = 10_000;

export type IncidentRow = {
  id: string;
  title: string;
  severity: "minor" | "major" | "critical";
  body: string;
  startedAt: Date;
  resolvedAt: Date | null;
};

/* ──────────────────────────────────────────────────────────────────────────
   Public reads — no auth.
   ──────────────────────────────────────────────────────────────────────── */

/** Current ongoing incidents (resolvedAt IS NULL). */
export async function listOpenIncidents(): Promise<IncidentRow[]> {
  const rows = await db()
    .select()
    .from(incidents)
    .where(isNull(incidents.resolvedAt))
    .orderBy(desc(incidents.startedAt));
  return rows.map(toRow);
}

/** Recent incidents — open + resolved within the last 90 days. */
export async function listRecentIncidents(): Promise<IncidentRow[]> {
  const cutoff = new Date(Date.now() - 90 * 86400_000);
  const rows = await db()
    .select()
    .from(incidents)
    .where(
      or(
        isNull(incidents.resolvedAt),
        gte(incidents.startedAt, cutoff)
      )
    )
    .orderBy(desc(incidents.startedAt))
    .limit(40);
  return rows.map(toRow);
}

export async function getIncidentForStaff(
  id: string
): Promise<IncidentRow | null> {
  await requireStaff();
  const rows = await db()
    .select()
    .from(incidents)
    .where(eq(incidents.id, id))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function listAllIncidentsForStaff(): Promise<IncidentRow[]> {
  await requireStaff();
  const rows = await db()
    .select()
    .from(incidents)
    .orderBy(desc(incidents.startedAt))
    .limit(100);
  return rows.map(toRow);
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff mutations
   ──────────────────────────────────────────────────────────────────────── */

export async function createIncident(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE);
  const severityRaw = String(formData.get("severity") ?? "minor");
  const severity = ALLOWED_SEVERITIES.has(severityRaw) ? severityRaw : "minor";
  const body = String(formData.get("body") ?? "").slice(0, MAX_BODY);
  if (!title) return;

  const id = crypto.randomUUID();
  await db().insert(incidents).values({
    id,
    title,
    severity,
    body,
  });

  await recordAudit({
    actorUserId: session.user.id,
    action: "incident.create",
    targetType: "incident",
    targetId: id,
    after: { title, severity },
  });

  revalidatePath("/status");
  revalidatePath("/admin/incidents");
  redirect(`/admin/incidents/${id}`);
}

export async function updateIncident(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE);
  const severityRaw = String(formData.get("severity") ?? "minor");
  const severity = ALLOWED_SEVERITIES.has(severityRaw) ? severityRaw : "minor";
  const body = String(formData.get("body") ?? "").slice(0, MAX_BODY);
  if (!title) return;

  await db()
    .update(incidents)
    .set({ title, severity, body, updatedAt: new Date() })
    .where(eq(incidents.id, id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "incident.update",
    targetType: "incident",
    targetId: id,
    after: { title, severity },
  });

  revalidatePath("/status");
  revalidatePath(`/admin/incidents/${id}`);
}

export async function resolveIncident(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db()
    .update(incidents)
    .set({ resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(incidents.id, id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "incident.resolve",
    targetType: "incident",
    targetId: id,
  });

  revalidatePath("/status");
  revalidatePath(`/admin/incidents/${id}`);
  revalidatePath("/admin/incidents");
}

export async function reopenIncident(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db()
    .update(incidents)
    .set({ resolvedAt: null, updatedAt: new Date() })
    .where(eq(incidents.id, id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "incident.reopen",
    targetType: "incident",
    targetId: id,
  });

  revalidatePath("/status");
  revalidatePath(`/admin/incidents/${id}`);
}

export async function deleteIncident(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db().delete(incidents).where(eq(incidents.id, id));

  await recordAudit({
    actorUserId: session.user.id,
    action: "incident.delete",
    targetType: "incident",
    targetId: id,
  });

  revalidatePath("/status");
  revalidatePath("/admin/incidents");
  redirect("/admin/incidents");
}

/* ──────────────────────────────────────────────────────────────────────── */

void sql; // imported for future query expansion (e.g. counts per severity)

function toRow(r: typeof incidents.$inferSelect): IncidentRow {
  return {
    id: r.id,
    title: r.title,
    severity: r.severity as IncidentRow["severity"],
    body: r.body,
    startedAt: new Date(r.startedAt),
    resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
  };
}
