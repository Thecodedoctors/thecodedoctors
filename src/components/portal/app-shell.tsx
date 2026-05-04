import { signOut } from "@/auth";
import { AppSidebar } from "./app-sidebar";
import { AppTopBar } from "./app-topbar";
import { BottomNav } from "./bottom-nav";
import { NotificationsBell } from "./notifications-bell";

type Variant = "client" | "admin";

/**
 * Portal shell. Sidebar on desktop, drawer + bottom-nav on mobile, slim
 * top bar with notifications + user menu always.
 *
 * Wraps any portal route layout. Pass `variant="admin"` for the practice
 * portal — different nav config + signal-red accent.
 */
export function AppShell({
  variant,
  user,
  children,
  topBanner,
}: {
  variant: Variant;
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  };
  children: React.ReactNode;
  /** Optional persistent banner (e.g. email verification). Renders
   *  above the main content but below the topbar. Pass null to hide. */
  topBanner?: React.ReactNode;
}) {
  // Sign out is a Server Action passed down to the client UserMenu component.
  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  return (
    <div className="flex min-h-screen">
      <AppSidebar variant={variant} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar
          variant={variant}
          user={user}
          signOutAction={signOutAction}
          bell={<NotificationsBell variant={variant} />}
        />
        {topBanner}
        <main className="flex-1">{children}</main>
        <BottomNav variant={variant} />
      </div>
    </div>
  );
}
