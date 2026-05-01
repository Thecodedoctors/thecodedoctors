import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PortalShell } from "@/components/portal-shell";

/**
 * Client portal layout. Auth-gated. Staff users get redirected to the admin
 * portal (they shouldn't see this view at all).
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
    redirect("/admin");
  }
  // Staff with 2FA pending would normally hit a /verify-2fa page first.
  // Phase 5 wires that flow; for now we trust DB state.

  return (
    <PortalShell
      variant="client"
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
