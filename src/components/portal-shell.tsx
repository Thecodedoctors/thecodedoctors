import Link from "next/link";
import { Stethoscope, FileText, Folder, Settings, LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

type Variant = "client" | "admin";

const CLIENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: FileText },
  { href: "/dashboard/requests", label: "Requests", icon: FileText },
  { href: "/dashboard/files", label: "Files", icon: Folder },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Inbox", icon: FileText },
  { href: "/admin/clients", label: "Clients", icon: Folder },
  { href: "/admin/audit", label: "Audit log", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function PortalShell({
  variant,
  user,
  children,
}: {
  variant: Variant;
  user: { email?: string | null; name?: string | null; role?: string };
  children: React.ReactNode;
}) {
  const nav = variant === "admin" ? ADMIN_NAV : CLIENT_NAV;
  const accent = variant === "admin" ? "text-signal" : "text-accent";
  const homeHref = variant === "admin" ? "/admin" : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl"
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <Link
              href={homeHref}
              className="flex items-center gap-2.5 text-foreground"
              aria-label="Code Doctors"
            >
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-md bg-surface ring-1 ring-border-strong",
                  accent
                )}
                aria-hidden
              >
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold tracking-tight">
                {variant === "admin" ? "Practice" : "Patient Portal"}
              </span>
            </Link>
            <nav aria-label="Portal" className="hidden md:flex items-center gap-5 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right text-xs sm:block">
              <p className="text-foreground">{user.name ?? user.email ?? ""}</p>
              {user.role && (
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  {user.role.replace("_", " ")}
                </p>
              )}
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
