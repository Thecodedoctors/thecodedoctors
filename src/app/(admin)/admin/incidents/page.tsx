import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Section } from "@/components/ui/section";
import { listAllIncidentsForStaff } from "@/server/incidents";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Incidents · Practice",
  robots: { index: false, follow: false },
};

const SEVERITY_CLS: Record<string, string> = {
  critical: "bg-signal/10 text-signal ring-signal/30",
  major: "bg-warning/10 text-warning ring-warning/30",
  minor: "bg-muted/10 text-muted ring-muted/20",
};

export default async function AdminIncidentsPage() {
  const incidents = await listAllIncidentsForStaff();
  const open = incidents.filter((i) => !i.resolvedAt);

  return (
    <Section size="md" reveal={false}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Incidents
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Status incidents
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            What customers see at{" "}
            <Link
              href="/status"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              /status
            </Link>
            . Open incidents render at the top of the public page; resolved
            ones drop to a 90-day history.
          </p>
        </div>
        <Link
          href="/incidents/new"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#e6e9ee]"
        >
          <Plus className="h-3.5 w-3.5" />
          New incident
        </Link>
      </div>

      {open.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-signal">
            Ongoing
          </h2>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-signal/30 bg-signal/5">
            {open.map((i) => (
              <Row key={i.id} incident={i} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
          History
        </h2>
        {incidents.filter((i) => i.resolvedAt).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No resolved incidents yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {incidents
              .filter((i) => i.resolvedAt)
              .map((i) => (
                <Row key={i.id} incident={i} />
              ))}
          </ul>
        )}
      </section>
    </Section>
  );
}

function Row({
  incident,
}: {
  incident: Awaited<ReturnType<typeof listAllIncidentsForStaff>>[number];
}) {
  return (
    <li>
      <Link
        href={`/incidents/${incident.id}`}
        className="flex flex-wrap items-center gap-3 px-5 py-4 transition-colors hover:bg-surface/40"
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1 ring-inset",
            incident.resolvedAt
              ? "bg-success/10 text-success ring-success/30"
              : "bg-signal/10 text-signal ring-signal/30"
          )}
        >
          {incident.resolvedAt ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-base font-medium text-foreground">
              {incident.title}
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                SEVERITY_CLS[incident.severity] ?? SEVERITY_CLS.minor
              )}
            >
              {incident.severity}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted">
            Started {formatRelativeAgo(incident.startedAt)}
            {incident.resolvedAt && (
              <> · Resolved {formatRelativeAgo(incident.resolvedAt)}</>
            )}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted" />
      </Link>
    </li>
  );
}
