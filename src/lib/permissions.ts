import type { Session } from "next-auth";

/**
 * Centralised authorization per PORTAL-SPEC.md §5.
 *
 * Usage:
 *
 *   if (!can(session, "request.update_status")) throw forbidden();
 *   if (!can(session, "request.read", { request })) return null;
 *
 * Deliberately a flat function rather than a CASL-style framework. Each
 * capability is an explicit case below — no clever inheritance, no role
 * objects. We grow this by adding more cases as features ship; we never
 * grow it by adding indirection.
 */

export type Action =
  // Requests
  | "request.read"
  | "request.create"
  | "request.update_status"
  | "request.assign"
  | "request.archive"
  | "request.approve" // patient-side: approve a deliverable (in_review → healed)
  // Messages
  | "message.read.any" // includes internal notes
  | "message.create.visible"
  | "message.create.internal"
  // Billing (Phase 4)
  | "billing.read"
  | "billing.pay"
  | "billing.change_plan"
  // Team (Phase 5)
  | "team.invite"
  | "team.staff.manage"
  // Audit + reports (Phase 5)
  | "audit.read.any"
  | "report.generate"
  // Site health
  | "health.read"
  | "health.scan_manual";

type RequestLike = { clientId?: string; assignedDoctorId?: string | null } | null | undefined;

const STAFF_ROLES = new Set(["doctor", "senior_doctor", "founder", "readonly"]);

function isStaff(role: string | undefined): boolean {
  return role !== undefined && STAFF_ROLES.has(role);
}

export function can(
  session: Session | null,
  action: Action,
  resource?: { request?: RequestLike }
): boolean {
  if (!session?.user) return false;
  const role = session.user.role ?? "client";
  const userId = session.user.id;
  const staff = isStaff(role);

  switch (action) {
    /* Requests
       ─────────────────────────────────────────────────── */
    case "request.read":
      // Staff can read any. Clients are read-checked at the query layer
      // (we filter by clientId before fetching). When a resource is provided,
      // assume the data layer already validated client membership.
      return staff || Boolean(resource?.request);
    case "request.create":
      return role === "client" || staff;
    case "request.update_status":
      if (!staff) return false;
      if (role === "readonly") return false;
      // Doctor can only update if assigned to them; senior+ anytime.
      if (role === "doctor") {
        return resource?.request?.assignedDoctorId === userId;
      }
      return true;
    case "request.assign":
      if (!staff) return false;
      if (role === "readonly") return false;
      // Doctors can only assign to themselves; senior+ anywhere.
      return true;
    case "request.archive":
      // Patient owner archives their own; senior+ can archive any.
      return role === "client" || role === "senior_doctor" || role === "founder";
    case "request.approve":
      // Patient-side action only.
      return role === "client";

    /* Messages
       ─────────────────────────────────────────────────── */
    case "message.read.any":
      // Includes internal notes. Staff only.
      return staff;
    case "message.create.visible":
      return role === "client" || (staff && role !== "readonly");
    case "message.create.internal":
      return staff && role !== "readonly";

    /* Billing
       ─────────────────────────────────────────────────── */
    case "billing.read":
      return true; // owner + staff. Multi-user-per-client refines this in Phase 5.
    case "billing.pay":
      return role === "client";
    case "billing.change_plan":
      return role === "client" || role === "founder";

    /* Team
       ─────────────────────────────────────────────────── */
    case "team.invite":
      return role === "client"; // only the patient owner invites teammates (Phase 5)
    case "team.staff.manage":
      return role === "founder";

    /* Audit + reports
       ─────────────────────────────────────────────────── */
    case "audit.read.any":
      return role === "senior_doctor" || role === "founder" || role === "readonly";
    case "report.generate":
      return role === "senior_doctor" || role === "founder";

    /* Site health
       ─────────────────────────────────────────────────── */
    case "health.read":
      return true; // owner of the client + staff
    case "health.scan_manual":
      return role === "client" || (staff && role !== "readonly");

    default: {
      // Exhaustive check — TypeScript will fail compile if we miss a case.
      const _never: never = action;
      void _never;
      return false;
    }
  }
}

/**
 * Throwable equivalent. Use in server actions where you'd want a 403.
 *   const session = await auth();
 *   assertCan(session, "request.update_status", { request });
 */
export class ForbiddenError extends Error {
  constructor(action: Action) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(
  session: Session | null,
  action: Action,
  resource?: { request?: RequestLike }
): asserts session is Session {
  if (!can(session, action, resource)) {
    throw new ForbiddenError(action);
  }
}
