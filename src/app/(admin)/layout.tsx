import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireStaff } from "@/lib/auth-helpers";
import { AppShell } from "@/components/portal/app-shell";

/**
 * Practice portal layout. Auth-gated via `requireStaff` — that helper
 * also bounces suspended/deleted users to /login (the raw `auth()`
 * we used to call here didn't, so a freshly-suspended doctor kept
 * working until JWT expiry).
 *
 * Two-factor enforcement: every staff user has `twoFactorRequired`
 * automatically set to true via the auth.ts session callback, so any
 * staff user without TOTP enrolled is bounced to /settings/security
 * on every page except that one. No env-flag toggle — staff are
 * always required to use 2FA, no exceptions.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff("/admin");
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
