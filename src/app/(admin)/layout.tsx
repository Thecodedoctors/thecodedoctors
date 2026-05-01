import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

/**
 * Admin (staff) portal layout. Only roles in STAFF_ROLES can see this.
 * Clients hitting /admin/* get redirected to their dashboard.
 *
 * Phase 5 will gate this further on TOTP verification — staff sessions
 * without a verified 2FA token redirect to /verify-2fa first.
 */
const STAFF_ROLES = new Set([
  "doctor",
  "senior_doctor",
  "founder",
  "readonly",
]);

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/admin");
  }
  if (!STAFF_ROLES.has(session.user.role ?? "client")) {
    redirect("/dashboard");
  }

  return (
    <PortalShell
      variant="admin"
      user={{
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </PortalShell>
  );
}
