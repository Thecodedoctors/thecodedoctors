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
 * Two-factor: when `TWO_FACTOR_ENFORCED=true` is set on the env, any
 * staff user without a configured authenticator is bounced to
 * /settings/security on every page except that one.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff("/admin");
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
