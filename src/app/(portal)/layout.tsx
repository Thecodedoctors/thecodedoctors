import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireClient } from "@/lib/auth-helpers";

/**
 * Client portal layout. Auth-gated via `requireClient` — that helper
 * also bounces suspended/deleted users to the login page (the raw
 * `auth()` call we used to use here didn't, so a freshly-suspended
 * staff member kept their session until JWT expiry).
 *
 * Two-factor enforcement: only patients explicitly flagged as
 * `twoFactorRequired` (set per-user by an admin via the team page or
 * SQL) get bounced to /settings/security to enroll. The default
 * patient experience has 2FA optional — forcing it on every patient
 * adds enrollment friction at every sign-up that hurts conversion.
 * Staff get blanket enforcement in their own layout.
 */
import { AppShell } from "@/components/portal/app-shell";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClient("/dashboard");
  if (session.user.twoFactorRequired && !session.user.totpEnabled) {
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
