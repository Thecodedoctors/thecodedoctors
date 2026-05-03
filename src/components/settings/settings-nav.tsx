import Link from "next/link";
import { User, Bell, Lock, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { auth } from "@/auth";

export type SettingsTab = "profile" | "notifications" | "security" | "staff";

type Tab = {
  key: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  founderOnly?: boolean;
};

const TABS: Tab[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Lock },
  { key: "staff", label: "Staff", icon: UserPlus, founderOnly: true },
];

/**
 * Server component — reads the session so we can hide founder-only
 * tabs (e.g. Staff onboarding) from non-founder staff. Patient surfaces
 * never render the founder-gated tabs because their session.user.role
 * isn't "founder".
 */
export async function SettingsNav({
  current,
  basePath,
  accent,
}: {
  current: SettingsTab;
  /** "/settings" — middleware resolves to the right subdomain. */
  basePath: string;
  accent: "accent" | "signal";
}) {
  const session = await auth();
  const isFounder = session?.user?.role === "founder";

  const activeText = accent === "accent" ? "text-accent" : "text-signal";
  const activeBg = accent === "accent" ? "bg-accent-soft" : "bg-signal/10";
  const activeRing =
    accent === "accent"
      ? "ring-1 ring-inset ring-accent/30"
      : "ring-1 ring-inset ring-signal/30";

  const visibleTabs = TABS.filter((t) => !t.founderOnly || isFounder);

  return (
    <nav className="-mx-2 mb-8 flex flex-wrap gap-1 sm:gap-2">
      {visibleTabs.map((t) => {
        const isActive = t.key === current;
        const href = `${basePath}/${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
              isActive
                ? cn(activeText, activeBg, activeRing, "font-medium")
                : "text-muted hover:bg-surface/50 hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
