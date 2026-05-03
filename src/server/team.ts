import { db, users, auditLog } from "@/db";
import { sql, ne, desc, eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";

export type StaffRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "founder" | "senior_doctor" | "doctor" | "readonly";
  totpEnabled: boolean;
  twoFactorRequired: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  deletedAt: Date | null;
  assignedOpen: number;
  assignedTotal: number;
};

/**
 * Staff roster — anyone whose role isn't `client`. Augments each row with
 * the count of requests currently assigned + total ever assigned.
 *
 * Sort: founders first, then senior_doctor, doctor, readonly; alphabetical
 * within role.
 */
export async function listStaffWithStats(): Promise<StaffRow[]> {
  await requireStaff();

  const rows = await db()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      totpEnabled: users.totpEnabled,
      twoFactorRequired: users.twoFactorRequired,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      suspendedAt: users.suspendedAt,
      suspensionReason: users.suspensionReason,
      deletedAt: users.deletedAt,
      assignedOpen: sql<number>`(
        select count(*)::int from request
        where request.assigned_doctor_id = ${users.id}
          and request.status not in ('healed','closed')
      )`,
      assignedTotal: sql<number>`(
        select count(*)::int from request
        where request.assigned_doctor_id = ${users.id}
      )`,
    })
    .from(users)
    .where(ne(users.role, "client"))
    .orderBy(users.name);

  const ROLE_ORDER: Record<StaffRow["role"], number> = {
    founder: 0,
    senior_doctor: 1,
    doctor: 2,
    readonly: 3,
  };

  return rows
    .map((r) => ({
      ...r,
      role: r.role as StaffRow["role"],
      lastLoginAt: r.lastLoginAt ? new Date(r.lastLoginAt) : null,
      createdAt: new Date(r.createdAt),
      suspendedAt: r.suspendedAt ? new Date(r.suspendedAt) : null,
      deletedAt: r.deletedAt ? new Date(r.deletedAt) : null,
    }))
    .sort((a, b) => {
      const dr = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
      if (dr !== 0) return dr;
      return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
    });
}

/**
 * Top-line stat strip for the team page: total staff, count by role,
 * count of staff with TOTP enabled (Phase 5 will require it; until then
 * we surface the gap).
 */
export async function teamHeadline(): Promise<{
  totalStaff: number;
  founders: number;
  doctors: number;
  readonly: number;
  totpEnabled: number;
}> {
  await requireStaff();
  const rows = await db()
    .select({
      role: users.role,
      totp: sql<number>`count(*) filter (where ${users.totpEnabled})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(ne(users.role, "client"))
    .groupBy(users.role);

  let totalStaff = 0;
  let founders = 0;
  let doctors = 0;
  let readonlyCount = 0;
  let totpEnabled = 0;
  for (const r of rows) {
    totalStaff += r.n;
    totpEnabled += r.totp;
    if (r.role === "founder") founders += r.n;
    else if (r.role === "doctor" || r.role === "senior_doctor") doctors += r.n;
    else if (r.role === "readonly") readonlyCount += r.n;
  }
  return {
    totalStaff,
    founders,
    doctors,
    readonly: readonlyCount,
    totpEnabled,
  };
}

/** Recent staff actions — convenience for the team page activity strip.
 *  Reuses the audit_log; just a thin pull keyed on actor.
 *  Filters out client actions (e.g. patient approvals) to keep the
 *  view focused on what staff have done. */
export async function recentStaffActivity(limit = 10) {
  await requireStaff();
  const rows = await db()
    .select({
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      ts: auditLog.ts,
      actorName: users.name,
      actorEmail: users.email,
      actorRole: users.role,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .orderBy(desc(auditLog.ts))
    .limit(limit * 3); // pull extra so post-filter still hits limit

  return rows
    .filter((r) => r.actorRole !== "client")
    .slice(0, limit)
    .map((r) => ({
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      ts: new Date(r.ts),
      actorName: r.actorName,
      actorEmail: r.actorEmail,
    }));
}
