import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Session as NextAuthSession } from "next-auth";

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
  return session;
}

/**
 * Server-side guard for client-only routes. Staff get bounced to /admin
 * (which on production redirects to admin.thecodedoctors.com via proxy.ts).
 */
export async function requireClient(redirectTo?: string): Promise<Session> {
  const session = await requireUser(redirectTo);
  if (isStaff(session.user.role)) {
    redirect("/admin");
  }
  return session;
}

/**
 * Server-side guard for staff-only routes. Clients get bounced to /dashboard
 * (which on production redirects to app.thecodedoctors.com via proxy.ts).
 */
export async function requireStaff(redirectTo?: string): Promise<Session> {
  const session = await requireUser(redirectTo);
  if (!isStaff(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}
