import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
  // 2FA enforcement gate. When `TWO_FACTOR_ENFORCED=true` is set on the
  // environment, every signed-in user without a configured authenticator
  // is bounced to /settings/security to set one up — *except* when
  // they're already on that page (otherwise we'd loop). The middleware
  // forwards the post-rewrite pathname via `x-pathname`.
  if (
    process.env.TWO_FACTOR_ENFORCED === "true" &&
    !session.user.totpEnabled
  ) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "";
    const onSecurityPage =
      path.includes("/settings/security") || path.startsWith("/api/");
    if (!onSecurityPage) {
      redirect("/settings/security?enforce=1");
    }
  }
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
