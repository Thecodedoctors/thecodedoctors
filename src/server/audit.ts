import { db, auditLog, users } from "@/db";
import { headers } from "next/headers";
import { desc, eq, sql } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";

/**
 * Append-only audit logger for staff actions. Wraps any mutation with a
 * persistent record of who did what, when, with the IP and user-agent.
 *
 * Failures here MUST NOT fail the underlying mutation — we log to console
 * and move on. The audit log is a reliability tool, not a transactional
 * dependency.
 */
export async function recordAudit({
  actorUserId,
  action,
  targetType,
  targetId,
  before,
  after,
}: {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get("cf-connecting-ip") ??
      h.get("x-real-ip") ??
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null;
    userAgent = h.get("user-agent");
  } catch {
    /* outside a request context — fine */
  }

  try {
    await db().insert(auditLog).values({
      actorUserId: actorUserId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      before: before === undefined ? null : (before as object | null),
      after: after === undefined ? null : (after as object | null),
      ip,
      userAgent,
    });
  } catch (err) {
    console.error("[audit] write failed", { action, targetType, targetId }, err);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Read side — staff-only audit log viewer.
   ──────────────────────────────────────────────────────────────────────── */

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  ts: Date;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
};

const PAGE_SIZE = 50;

export async function listAuditLogForStaff(opts?: {
  page?: number;
}): Promise<{ entries: AuditEntry[]; total: number; page: number; totalPages: number }> {
  await requireStaff();
  const page = Math.max(1, opts?.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [entries, totals] = await Promise.all([
    db()
      .select({
        id: auditLog.id,
        action: auditLog.action,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        before: auditLog.before,
        after: auditLog.after,
        ip: auditLog.ip,
        ts: auditLog.ts,
        actorId: auditLog.actorUserId,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .orderBy(desc(auditLog.ts))
      .limit(PAGE_SIZE)
      .offset(offset),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(auditLog),
  ]);
  const total = totals[0]?.n ?? 0;
  return {
    entries,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
