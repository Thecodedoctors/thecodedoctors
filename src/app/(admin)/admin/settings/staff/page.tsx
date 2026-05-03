import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Crown } from "lucide-react";
import { requireStaff } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { StaffInviteForm } from "@/components/admin/staff-invite-form";
import { listStaffWithStats } from "@/server/team";
import { formatRelativeAgo } from "@/lib/time";

export const metadata: Metadata = {
  title: "Staff · Practice settings",
  robots: { index: false, follow: false },
};

/**
 * Founder-only staff onboarding surface. Non-founder staff are bounced
 * to /settings/profile so the tab even existing in the URL doesn't
 * leak surface area.
 */
export default async function AdminStaffSettingsPage() {
  const session = await requireStaff();
  if (session.user.role !== "founder") {
    redirect("/settings/profile");
  }

  const staff = await listStaffWithStats();

  return (
    <SettingsShell
      current="staff"
      basePath="/settings"
      accent="signal"
      title="Staff onboarding"
      description="Add a doctor, promote an existing user, or grant read-only access. Founder-only."
    >
      <div className="space-y-8">
        <div className="rounded-xl border border-accent/30 bg-accent-soft/15 p-4">
          <div className="flex items-start gap-2">
            <Crown className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-xs text-foreground">
              You're the only one who sees this tab. Founder elevations are
              still SQL-only by design.
            </p>
          </div>
        </div>

        <StaffInviteForm />

        <section className="border-t border-border/60 pt-8">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Current roster
          </h2>
          <p className="mt-1 text-xs text-muted">
            Same roster as the{" "}
            <a
              href="/team"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              Team page
            </a>
            ; condensed here for context.
          </p>
          <ul className="mt-4 divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-surface/30">
            {staff.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted">
                Nobody on staff yet — you're the first.
              </li>
            ) : (
              staff.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-foreground">
                    {s.name ?? s.email ?? "(unnamed)"}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {prettyRole(s.role)}
                  </span>
                  {s.email && (
                    <span className="font-mono text-xs text-muted">
                      {s.email}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[11px] text-muted">
                    Joined{" "}
                    {formatRelativeAgo(s.createdAt)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </SettingsShell>
  );
}

function prettyRole(role: string): string {
  if (role === "founder") return "Founder";
  if (role === "senior_doctor") return "Senior doctor";
  if (role === "doctor") return "Doctor";
  if (role === "readonly") return "Read-only";
  return role;
}
