import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AppShell } from "@/components/portal/app-shell";
import { APP_HOME } from "@/lib/portal-redirect";

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
 * Two-factor: when `TWO_FACTOR_ENFORCED=true` is set on the env, any
 * staff user without a configured authenticator is bounced to
 * /settings/security on every page except that one.
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
    redirect(APP_HOME);
  }
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
