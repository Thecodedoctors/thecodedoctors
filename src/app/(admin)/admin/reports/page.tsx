import type { Metadata } from "next";
import Link from "next/link";
import {
  TrendingUp,
  Clock,
  Users,
  Activity,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  requestVolumeByWeek,
  resolutionTimeByWeek,
  statusDistribution,
  signupSourceBreakdown,
  topActivePatients,
  reportHeadline,
} from "@/server/reports";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Reports · Practice",
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  triaged: "New",
  diagnosed: "Reviewed",
  in_treatment: "In progress",
  in_review: "Awaiting approval",
  healed: "Resolved",
  closed: "Closed",
};

const SOURCE_LABEL: Record<string, string> = {
  trial: "Free trial",
  plan: "Paid plan",
  legacy: "Legacy / seeded",
};

export default async function ReportsPage() {
  const [headline, volume, resolution, statuses, sources, topPatients] =
    await Promise.all([
      reportHeadline(),
      requestVolumeByWeek(),
      resolutionTimeByWeek(),
      statusDistribution(),
      signupSourceBreakdown(),
      topActivePatients(),
    ]);

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Reports
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Practice at a glance
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Last 8 weeks of request flow, current status distribution, signup
          mix, and the patients keeping you busiest right now.
        </p>
      </div>

      {/* Headline strip */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Activity}
          label="Total requests"
          value={String(headline.totalRequests)}
          sub={`${headline.resolvedRequests} resolved`}
        />
        <Stat
          icon={Clock}
          label="Avg resolution"
          value={
            headline.avgResolutionDays !== null
              ? `${headline.avgResolutionDays.toFixed(1)} d`
              : "—"
          }
          sub="Triaged → Resolved"
        />
        <Stat
          icon={TrendingUp}
          label="New sign-ups"
          value={String(headline.newSignupsLast30d)}
          sub="Last 30 days"
        />
        <Stat
          icon={Users}
          label="Active trials"
          value={String(headline.activeTrials)}
          sub="Inside trial window"
        />
      </ul>

      {/* Charts row */}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Card title="Request volume" subtitle="New requests per week, last 8 weeks">
          <BarChart
            data={volume.map((b) => ({ label: b.label, value: b.count }))}
            color="signal"
            unit=""
          />
        </Card>
        <Card
          title="Resolution time"
          subtitle="Avg days from triaged to resolved, by week"
        >
          <BarChart
            data={resolution.map((b) => ({
              label: b.label,
              value: Number(b.avgDays.toFixed(1)),
              hint: b.n > 0 ? `${b.n} resolved` : undefined,
            }))}
            color="accent"
            unit="d"
          />
        </Card>
      </div>

      {/* Status + signup mix */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card title="Status distribution" subtitle="Open requests, live snapshot">
          {statuses.length === 0 ? (
            <p className="text-sm text-muted">No requests yet.</p>
          ) : (
            <ProportionRows
              rows={statuses
                .sort((a, b) => b.count - a.count)
                .map((s) => ({
                  label: STATUS_LABEL[s.status] ?? s.status,
                  value: s.count,
                }))}
              color="signal"
            />
          )}
        </Card>
        <Card title="Signup mix" subtitle="How each active patient arrived">
          {sources.length === 0 ? (
            <p className="text-sm text-muted">No patients yet.</p>
          ) : (
            <ProportionRows
              rows={sources
                .sort((a, b) => b.count - a.count)
                .map((s) => ({
                  label: SOURCE_LABEL[s.source] ?? s.source,
                  value: s.count,
                }))}
              color="accent"
            />
          )}
        </Card>
      </div>

      {/* Top patients */}
      <div className="mt-8">
        <Card title="Most active patients" subtitle="Top 5 by request activity in the last 30 days">
          {topPatients.length === 0 ? (
            <p className="text-sm text-muted">
              No patient activity in the last 30 days.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 -mx-6 -mb-6">
              {topPatients.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/clients/${p.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-surface/60"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-mono text-2xl font-semibold tabular-nums text-muted/60 w-8">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-base font-medium text-foreground">
                          {p.name}
                        </p>
                        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                          {planLabel(p.plan)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono text-base font-semibold text-foreground">
                          {p.activityCount}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                          touches
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface/40 p-5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-signal/10 text-signal ring-1 ring-inset ring-signal/30">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </li>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          {title}
        </p>
        <h3 className="mt-1.5 text-base font-semibold tracking-tight">
          {subtitle}
        </h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BarChart({
  data,
  color,
  unit,
}: {
  data: { label: string; value: number; hint?: string }[];
  color: "accent" | "signal";
  unit: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barColor = color === "accent" ? "bg-accent" : "bg-signal";

  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {data.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div className="absolute -top-6 hidden text-center group-hover:block">
                <span className="rounded bg-foreground/90 px-1.5 py-0.5 font-mono text-[10px] text-background">
                  {d.value}
                  {unit}
                  {d.hint ? ` · ${d.hint}` : ""}
                </span>
              </div>
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all",
                  d.value > 0 ? barColor : "bg-border"
                )}
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? "4px" : "2px" }}
                aria-label={`${d.label}: ${d.value}${unit}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d) => (
          <span
            key={d.label}
            className="flex-1 text-center font-mono text-[10px] text-muted"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProportionRows({
  rows,
  color,
}: {
  rows: { label: string; value: number }[];
  color: "accent" | "signal";
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const barColor = color === "accent" ? "bg-accent" : "bg-signal";

  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
        return (
          <li key={r.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-foreground">{r.label}</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full", barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-sm text-foreground tabular-nums">
              {r.value}
            </span>
            <span className="w-10 shrink-0 text-right font-mono text-xs text-muted tabular-nums">
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return plan;
}
