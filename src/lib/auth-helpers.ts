import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session as NextAuthSession } from "next-auth";
import { ADMIN_HOME, APP_HOME } from "@/lib/portal-redirect";

export type Session = NextAuthSession;
export type SessionUser = Session["user"];

export const STAFF_ROLES = new Set([
  "doctor",
  "senior_doctor",
  "founder",
  "readonly",
] as const);

export type StaffRole = "doctor" | "senior_doctor" | "founder" | "readonly";

export function isStaff(role: string | undefined): boolean {
  return Boolean(role) && STAFF_ROLES.has(role as StaffRole);
}

/**
 * Server-side guard: returns the session for a logged-in user, or redirects
 * to /login. Use at the top of any auth-required page or server action.
 *
 * The `next` param uses /dashboard or /admin as a marker — the auth.ts
 * redirect callback rewrites that to the appropriate subdomain in production.
 */
export async function requireUser(redirectTo?: string): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?next=${encodeURIComponent(redirectTo ?? "/dashboard")}`);
  }
  // Suspended or soft-deleted users get bounced — even with a still-
  // valid JWT cookie. The session callback re-pulls the flags every
  // request so this catches in-flight suspensions.
  if (session.user.suspended || session.user.deleted) {
    redirect("/login?error=Suspended");
  }
  // NB: 2FA enforcement lives in the (admin) and (portal) layouts —
  // we can't add the `next/headers` check here because this module is
  // also imported by a Client Component (`message-thread`), and Next's
  // build refuses to ship `next/headers` to the client bundle.
  return session;
}

/**
 * Server-side guard for client-only routes. Staff get bounced to the admin
 * portal (absolute URL in prod — relative redirects stay on the current
 * subdomain and end up 404'd by the host-rewrite middleware).
 */
export async function requireClient(redirectTo?: string): Promise<Session> {
  const session = await requireUser(redirectTo);
  if (isStaff(session.user.role)) {
    redirect(ADMIN_HOME);
  }
  return session;
}

/**
 * Server-side guard for staff-only routes. Clients get bounced to the
 * patient portal (absolute URL in prod for the same reason as above).
 */
export async function requireStaff(redirectTo?: string): Promise<Session> {
  const session = await requireUser(redirectTo);
  if (!isStaff(session.user.role)) {
    redirect(APP_HOME);
  }
  return session;
}

/**
 * Strictest gate — founder only. Used for the credential vault
 * (read side only) and any other action where the founder explicitly
 * said "only me." Other staff get bounced to /admin.
 *
 * Switching this to allow doctors later is a one-liner: replace the
 * role check with `if (!isStaff(session.user.role))`.
 */
export async function requireFounder(redirectTo?: string): Promise<Session> {
  const session = await requireStaff(redirectTo);
  if (session.user.role !== "founder") {
    redirect(ADMIN_HOME);
  }
  return session;
}
