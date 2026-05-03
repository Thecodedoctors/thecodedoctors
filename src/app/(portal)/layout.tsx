import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/portal/app-shell";
import { ADMIN_HOME } from "@/lib/portal-redirect";

/**
 * Client portal layout. Auth-gated. Staff users get redirected to the
 * admin portal — they shouldn't see this view.
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
