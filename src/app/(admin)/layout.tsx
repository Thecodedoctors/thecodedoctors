import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/portal/app-shell";

const STAFF_ROLES = new Set([
  "doctor",
  "senior_doctor",
  "founder",
  "readonly",
]);

/**
 * Practice portal layout. Only staff roles can see this; clients hitting
 * /admin/* get redirected to their dashboard.
 *
 * Phase 5 will gate this further on TOTP verification — staff sessions
 * without a verified 2FA token will redirect to /verify-2fa first.
 */
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
    <AppShell
      variant="admin"
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
