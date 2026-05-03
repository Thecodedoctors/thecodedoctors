import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { reportStatusByClient } from "@/server/monthly-reports";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Reports · Practice",
  robots: { index: false, follow: false },
};

const STATE_CONFIG = {
  overdue: {
    label: "Overdue",
    icon: AlertCircle,
    cls: "bg-signal/10 text-signal ring-signal/30",
  },
  due_soon: {
    label: "Due soon",
    icon: Clock,
    cls: "bg-warning/10 text-warning ring-warning/30",
  },
  ok: {
    label: "On track",
    icon: CheckCircle2,
    cls: "bg-success/10 text-success ring-success/30",
  },
  never: {
    label: "Never sent",
    icon: AlertCircle,
    cls: "bg-signal/10 text-signal ring-signal/30",
  },
} as const;

export default async function AdminReportsLanding() {
  const rows = await reportStatusByClient();
  const overdue = rows.filter((r) => r.state === "overdue" || r.state === "never");
  const dueSoon = rows.filter((r) => r.state === "due_soon");
  const onTrack = rows.filter((r) => r.state === "ok");

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Reports
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Monthly reports
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Each active patient gets a monthly report covering what was
          treated, what&apos;s healthy, and what&apos;s next. We remind you
          5 days before the 30-day mark.
        </p>
      </div>

      {/* Stat strip */}
      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          label="Overdue"
          value={overdue.length}
          tone="signal"
          icon={AlertCircle}
        />
        <SummaryStat
          label="Due soon"
          value={dueSoon.length}
          tone="warning"
          icon={Clock}
        />
        <SummaryStat
          label="On track"
          value={onTrack.length}
          tone="success"
          icon={CheckCircle2}
        />
      </ul>

      {/* Overdue + due-soon callouts go first so they don't get buried */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Needs attention
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-signal/30 bg-signal/5">
            {[...overdue, ...dueSoon].map((r) => (
              <PatientRow key={r.clientId} row={r} />
            ))}
          </ul>
        </section>
      )}

      {/* Everyone else */}
      <section className="mt-12">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          {onTrack.length === 0
            ? "All active patients"
            : `On track (${onTrack.length})`}
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No active patients yet — reports start once you have one.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {(onTrack.length > 0 ? onTrack : rows).map((r) => (
              <PatientRow key={r.clientId} row={r} />
            ))}
          </ul>
        )}
      </section>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function PatientRow({
  row,
}: {
  row: Awaited<ReturnType<typeof reportStatusByClient>>[number];
}) {
  const cfg = STATE_CONFIG[row.state];
  const Icon = cfg.icon;
  return (
    <li>
      <Link
        href={`/reports/${row.clientId}`}
        className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/40"
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-inset",
            cfg.cls
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium text-foreground">
            {row.clientName}
          </p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {row.lastPublishedAt
              ? `Last report ${formatRelativeAgo(row.lastPublishedAt)} · ${row.daysSinceLast}d ago`
              : "No reports sent yet"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
            cfg.cls
          )}
        >
          {cfg.label}
        </span>
        <ArrowRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}

function SummaryStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "signal" | "warning" | "success";
  icon: typeof FileText;
}) {
  const tones = {
    signal: "bg-signal/10 text-signal ring-signal/30",
    warning: "bg-warning/10 text-warning ring-warning/30",
    success: "bg-success/10 text-success ring-success/30",
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
