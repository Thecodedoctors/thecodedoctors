import { db, auditLog } from "@/db";
import { headers } from "next/headers";

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
