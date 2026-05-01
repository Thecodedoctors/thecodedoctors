import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/portal/app-shell";

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
    redirect("/admin");
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
