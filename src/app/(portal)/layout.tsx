import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireClient } from "@/lib/auth-helpers";

/**
 * Client portal layout. Auth-gated via `requireClient` — that helper
 * also bounces suspended/deleted users to the login page (the raw
 * `auth()` call we used to use here didn't, so a freshly-suspended
 * staff member kept their session until JWT expiry).
 *
 * Two-factor: when `TWO_FACTOR_ENFORCED=true` is set on the env, any
 * patient without a configured authenticator is bounced to
 * /settings/security until they set one up.
 */
import { AppShell } from "@/components/portal/app-shell";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClient("/dashboard");
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
