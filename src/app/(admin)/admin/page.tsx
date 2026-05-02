import type { Metadata } from "next";
import Link from "next/link";
import {
  Inbox,
  Users,
  Activity,
  Shield,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { listAllRequestsForStaff, staffStats } from "@/server/requests";
import {
  activityForStaff,
  clientPortfolioForStaff,
} from "@/server/activity";
import { fleetSummaryForStaff } from "@/server/health";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FleetAlertStrip } from "@/components/admin/fleet-alert-strip";
import { FleetStatusCard } from "@/components/admin/fleet-status-card";
import { RevenueSection } from "@/components/admin/revenue-section";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Practice",
  description: "Code Doctors practice dashboard.",
  robots: { index: false, follow: false },
};

type Tab = "triage" | "mine" | "all";

const TABS: { value: Tab; label: string }[] = [
  { value: "triage", label: "Needs triage" },
  { value: "mine", label: "Assigned to me" },
  { value: "all", label: "All requests" },
];

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const params = await searchParams;
  const activeTab: Tab =
    params.tab === "mine" || params.tab === "all" ? params.tab : "triage";

  const firstName = session.user.name?.split(" ")[0] ?? "Doctor";

  const [requests, stats, activity, portfolio, fleet] = await Promise.all([
    listAllRequestsForStaff(),
    staffStats(),
    activityForStaff(10),
    clientPortfolioForStaff(5),
    fleetSummaryForStaff(),
  ]);

  const open = requests.filter(
    (r) => r.status !== "healed" && r.status !== "closed"
  );

  const triage = requests.filter(
    (r) => r.status === "triaged" && !r.assignedDoctorName
  );
  const mine = requests.filter((r) => r.assignedDoctorName === session.user.name);

  const filtered =
    activeTab === "triage" ? triage : activeTab === "mine" ? mine : requests;

  return (
    <Section size="md" reveal={false} className="!py-12 md:!py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Practice
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Good morning, {firstName}.
          </h1>
          <p className="mt-2 text-base text-muted">
            {open.length === 0
              ? "Inbox is empty. Either we're caught up, or no one's submitted today."
              : `${open.length} open request${open.length === 1 ? "" : "s"}${
                  stats.urgentRequests > 0
                    ? ` · ${stats.urgentRequests} urgent`
                    : ""
                }${triage.length > 0 ? ` · ${triage.length} needs triage` : ""}.`}
          </p>
        </div>
      </div>

      {/* Fleet alert — only renders when 1+ sites are down */}
      <FleetAlertStrip summary={fleet} />

      {/* Revenue — founder-only (component renders nothing for other roles) */}
      <RevenueSection />

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open"
          value={stats.openRequests}
          icon={Inbox}
          tone="accent"
        />
        <StatCard
          label="Urgent"
          value={stats.urgentRequests}
          icon={Shield}
          tone="signal"
        />
        <StatCard
          label="Active patients"
          value={stats.activeClients}
          icon={Users}
          tone="muted"
        />
        <StatCard
          label="Sites down"
          value={fleet.down}
          icon={Activity}
          tone={fleet.down > 0 ? "signal" : "muted"}
        />
      </ul>

      <div className="mt-12 grid gap-6 lg:grid-cols-12">
        {/* Main inbox column */}
        <div className="lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Inbox
            </h2>
            <nav
              aria-label="Inbox filter"
              className="inline-flex items-center gap-1 rounded-lg border border-border-strong bg-surface/40 p-1"
            >
              {TABS.map((t) => {
                const count =
                  t.value === "triage"
                    ? triage.length
                    : t.value === "mine"
                      ? mine.length
                      : requests.length;
                const active = t.value === activeTab;
                return (
                  <Link
                    key={t.value}
                    href={`/?tab=${t.value}`}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px]",
                        active
                          ? "bg-background/20 text-background"
                          : "bg-border text-muted"
                      )}
                    >
                      {count}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                {activeTab === "triage" ? "Nothing to triage" : "Empty"}
              </p>
              <p className="mt-3 text-foreground">
                {activeTab === "triage"
                  ? "All new requests are assigned. Nice."
                  : activeTab === "mine"
                    ? "Nothing assigned to you yet."
                    : "No requests in the system yet."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-surface/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                          {r.clientName}
                          {r.assignedDoctorName && (
                            <> · {r.assignedDoctorName}</>
                          )}
                        </p>
                        <h3 className="mt-1 text-base font-medium text-foreground">
                          {r.title}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                          <TypeLabel type={r.type} />
                          <span className="text-muted">·</span>
                          <PriorityPill priority={r.priority} />
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column: fleet status + activity feed */}
        <div className="lg:col-span-4 space-y-8">
          {/* Quiet fleet card — only when no one is down (down case is
              handled by the alert strip up top so we don't double-shout). */}
          {fleet.down === 0 && <FleetStatusCard summary={fleet} />}

          <div>
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Practice activity
            </h2>
            <ActivityFeed
              items={activity}
              variant="admin"
              emptyText="No activity in the practice yet."
            />
          </div>
        </div>
      </div>

      {/* Client portfolio */}
      <div className="mt-12">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Patient portfolio
          </h2>
          <span className="text-xs text-muted">
            Full CRM ships in our next release
          </span>
        </div>
        {portfolio.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center text-sm text-muted">
            No patients yet.
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {portfolio.map((c) => (
              <li
                key={c.id}
                className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                    {c.plan === "checkup"
                      ? "Free Checkup"
                      : c.plan === "general"
                        ? "General Care"
                        : c.plan === "premium"
                          ? "Premium Care"
                          : "Custom"}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                      c.status === "active"
                        ? "bg-success/10 text-success ring-success/30"
                        : c.status === "lead"
                          ? "bg-muted/10 text-muted ring-muted/20"
                          : "bg-warning/10 text-warning ring-warning/30"
                    )}
                  >
                    {c.status === "active" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {c.status}
                  </span>
                </div>
                <h3 className="text-base font-semibold tracking-tight">
                  {c.name}
                </h3>
                {c.websiteUrl && (
                  <p className="truncate font-mono text-xs text-muted">
                    {c.websiteUrl}
                  </p>
                )}
                <p className="mt-auto font-mono text-xs text-muted">
                  Joined{" "}
                  {new Date(c.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "accent" | "signal" | "muted";
}) {
  const toneClasses = {
    accent: "text-accent bg-accent-soft ring-accent/20",
    signal: "text-signal bg-signal/10 ring-signal/30",
    muted: "text-muted bg-muted/10 ring-muted/20",
  } as const;
  return (
    <li className="card-hover flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-6">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg ring-1 ring-inset",
          toneClasses[tone]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="font-mono text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
    </li>
  );
}
