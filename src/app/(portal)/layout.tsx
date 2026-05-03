import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AppShell } from "@/components/portal/app-shell";
import { ADMIN_HOME } from "@/lib/portal-redirect";

/**
 * Client portal layout. Auth-gated. Staff users get redirected to the
 * admin portal — they shouldn't see this view.
 *
 * Two-factor: when `TWO_FACTOR_ENFORCED=true` is set on the env, any
 * patient without a configured authenticator is bounced to
 * /settings/security until they set one up.
 */
export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/dashboard");
  }
  if (session.user.role && session.user.role !== "client") {
    redirect(ADMIN_HOME);
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
      variant="client"
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
