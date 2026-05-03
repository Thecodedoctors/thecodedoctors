import type { Metadata } from "next";
import {
  Users,
  Crown,
  Stethoscope,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Pause,
  Play,
  Trash2,
  Ban,
  Unlock,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { auth } from "@/auth";
import {
  listStaffWithStats,
  teamHeadline,
  recentStaffActivity,
  type StaffRow,
} from "@/server/team";
import {
  suspendUser,
  unsuspendUserForm,
  deleteUser,
} from "@/server/lifecycle";
import { resetTwoFactorForUser } from "@/server/two-factor";
import { ReasonActionButton } from "@/components/admin/reason-action-button";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Team · Practice",
  robots: { index: false, follow: false },
};

const ROLE_CONFIG: Record<
  StaffRow["role"],
  { label: string; icon: typeof Crown; cls: string }
> = {
  founder: {
    label: "Founder",
    icon: Crown,
    cls: "bg-accent-soft text-accent ring-accent/30",
  },
  senior_doctor: {
    label: "Senior doctor",
    icon: Stethoscope,
    cls: "bg-success/10 text-success ring-success/30",
  },
  doctor: {
    label: "Doctor",
    icon: Stethoscope,
    cls: "bg-muted/10 text-muted ring-muted/20",
  },
  readonly: {
    label: "Read-only",
    icon: Eye,
    cls: "bg-warning/10 text-warning ring-warning/30",
  },
};

const ACTION_LABEL: Record<string, string> = {
  "request.update_status": "changed request status",
  "request.approved": "approved a request",
  "request.assign_self": "self-assigned a request",
  "request.archive": "archived a request",
  "request.unarchive": "restored a request",
  "message.add_staff": "replied on a request",
  "message.add_internal": "added an internal note",
  "client.update": "updated a patient",
  "user.password_changed": "changed their password",
};

export default async function TeamPage() {
  const [session, staff, headline, activity] = await Promise.all([
    auth(),
    listStaffWithStats(),
    teamHeadline(),
    recentStaffActivity(10),
  ]);
  const isFounder = session?.user?.role === "founder";
  const myUserId = session?.user?.id ?? "";

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Team
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {headline.totalStaff === 0
            ? "No doctors on staff yet"
            : `${headline.totalStaff} doctor${headline.totalStaff === 1 ? "" : "s"} on staff`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Everyone with access to the practice portal. Patient-side users
          live under <span className="font-mono text-foreground">Patients</span>.
        </p>
      </div>

      {/* Headline strip */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Founders" value={headline.founders} icon={Crown} />
        <Stat label="Doctors" value={headline.doctors} icon={Stethoscope} />
        <Stat label="Read-only" value={headline.readonly} icon={Eye} />
        <Stat
          label="2FA enabled"
          value={`${headline.totpEnabled} / ${headline.totalStaff}`}
          icon={
            headline.totpEnabled === headline.totalStaff
              ? ShieldCheck
              : ShieldAlert
          }
          tone={
            headline.totpEnabled === headline.totalStaff ? "success" : "signal"
          }
        />
      </ul>

      {/* Staff list */}
      <section className="mt-12">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Roster
        </h2>
        {staff.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
              <Users className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm text-muted">
              Nobody has been promoted to staff yet. The first founder was
              promoted via SQL during setup.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {staff.map((s) => {
              const config = ROLE_CONFIG[s.role];
              const Icon = config.icon;
              const showActions =
                isFounder && s.role !== "founder" && s.id !== myUserId;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex flex-wrap items-center gap-4 px-5 py-4",
                    s.deletedAt && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-inset",
                      config.cls
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-base font-medium text-foreground">
                        {s.name ?? s.email ?? "(unnamed)"}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                          config.cls
                        )}
                      >
                        {config.label}
                      </span>
                      {s.deletedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-signal/10 text-signal ring-1 ring-inset ring-signal/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                          <Trash2 className="h-2.5 w-2.5" />
                          Deleted
                        </span>
                      ) : s.suspendedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning ring-1 ring-inset ring-warning/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                          <Ban className="h-2.5 w-2.5" />
                          Suspended
                        </span>
                      ) : null}
                      {s.role !== "readonly" && !s.totpEnabled && !s.deletedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning ring-1 ring-inset ring-warning/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]">
                          <ShieldAlert className="h-2.5 w-2.5" />
                          No 2FA
                        </span>
                      )}
                    </div>
                    {s.email && (
                      <p className="mt-0.5 font-mono text-xs text-muted truncate">
                        {s.email}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
                      <span>
                        <span className="text-foreground">{s.assignedOpen}</span>{" "}
                        open · {s.assignedTotal} total assigned
                      </span>
                      {s.lastLoginAt && (
                        <span>
                          Last login {formatRelativeAgo(s.lastLoginAt)}
                        </span>
                      )}
                      <span>
                        Joined{" "}
                        {new Date(s.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {s.suspensionReason && (
                      <p className="mt-2 rounded-md bg-warning/5 px-3 py-2 text-xs text-foreground ring-1 ring-inset ring-warning/20">
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-warning">
                          Suspension reason
                        </span>
                        <br />
                        {s.suspensionReason}
                      </p>
                    )}
                  </div>
                  {showActions && !s.deletedAt && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {s.suspendedAt ? (
                        <form action={unsuspendUserForm}>
                          <input type="hidden" name="userId" value={s.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-success hover:text-success"
                          >
                            <Play className="h-3 w-3" />
                            Restore
                          </button>
                        </form>
                      ) : (
                        <ReasonActionButton
                          action={suspendUser}
                          hiddenFields={{ userId: s.id }}
                          trigger={{ label: "Suspend", icon: <Pause className="h-3 w-3" /> }}
                          tone="danger"
                          title={`Suspend ${s.name ?? s.email ?? "this account"}?`}
                          description="They won't be able to sign in until you restore them. We'll email them with the reason below."
                          confirmLabel="Suspend account"
                        />
                      )}
                      {s.totpEnabled && (
                        <ReasonActionButton
                          action={resetTwoFactorForUser}
                          hiddenFields={{ userId: s.id }}
                          trigger={{ label: "Reset 2FA", icon: <Unlock className="h-3 w-3" /> }}
                          tone="muted"
                          title={`Reset 2FA for ${s.name ?? s.email ?? "this account"}?`}
                          description="Wipes their authenticator + recovery codes so they can sign in with password alone. Use only when they've lost their device AND their saved recovery codes — re-enabling 2FA after sign-in is the user's job. We'll email them with the reason below."
                          confirmLabel="Reset 2FA"
                        />
                      )}
                      <ReasonActionButton
                        action={deleteUser}
                        hiddenFields={{ userId: s.id }}
                        trigger={{ label: "Delete", icon: <Trash2 className="h-3 w-3" /> }}
                        tone="danger"
                        title={`Delete ${s.name ?? s.email ?? "this account"}?`}
                        description="The account is closed (soft delete — records remain on file). Password is wiped; sign-in is blocked permanently. We'll email them with the reason below. Hard deletes are SQL-only."
                        confirmLabel="Close account"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent staff activity */}
      <section className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Recent staff activity
          </h2>
          <a
            href="/audit"
            className="text-xs text-muted hover:text-foreground"
          >
            Open full audit log →
          </a>
        </div>
        {activity.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No staff actions logged yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {activity.map((a, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm"
              >
                <span className="font-medium text-foreground">
                  {a.actorName ?? a.actorEmail ?? "(deleted)"}
                </span>
                <span className="text-muted">
                  {ACTION_LABEL[a.action] ?? a.action.replace(/[._]/g, " ")}
                </span>
                <time
                  className="ml-auto font-mono text-xs text-muted"
                  title={formatAbsolute(a.ts)}
                >
                  {formatRelativeAgo(a.ts)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Adding doctors — points founders at the onboarding flow. The
          settings page itself is founder-gated, so non-founders won't
          see anything when they click through. */}
      <div className="mt-12 rounded-2xl border border-border bg-surface/40 p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          Adding doctors
        </p>
        <h3 className="mt-2 text-base font-semibold tracking-tight">
          Add a doctor or grant read-only access
        </h3>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Use{" "}
          <a
            href="/settings/staff"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Settings → Staff
          </a>{" "}
          to invite by email or promote an existing user. Founder-only;
          founder elevations remain SQL-only by design.
        </p>
      </div>
    </Section>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "muted",
}: {
  label: string;
  value: number | string;
  icon: typeof Crown;
  tone?: "muted" | "success" | "signal";
}) {
  const tones = {
    muted: "bg-muted/10 text-muted ring-muted/20",
    success: "bg-success/10 text-success ring-success/30",
    signal: "bg-signal/10 text-signal ring-signal/30",
  } as const;
  return (
    <li className="rounded-2xl border border-border bg-surface/40 p-5">
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset",
          tones[tone]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
    </li>
  );
}
