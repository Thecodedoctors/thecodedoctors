import Link from "next/link";
import { Activity, ArrowRight, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import type { FleetSummary } from "@/server/health";

/**
 * Compact fleet status card for the admin home — shown when the fleet is
 * healthy (the FleetAlertStrip takes over when anything is down). Quick
 * green/amber/red breakdown + link into the full fleet view.
 */
export function FleetStatusCard({ summary }: { summary: FleetSummary }) {
  if (summary.total === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface/40 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Fleet
            </p>
            <h3 className="mt-2 text-lg font-semibold tracking-tight">
              No sites being watched
            </h3>
            <p className="mt-2 text-sm text-muted">
              Patients add their site URL on the hub. Once they do, it
              appears here.
            </p>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted/10 text-muted ring-1 ring-inset ring-muted/20">
            <Activity className="h-4 w-4" />
          </span>
        </div>
      </section>
    );
  }

  // Down case is handled by FleetAlertStrip — this card is only for
  // healthy / partial-checked fleets.
  const allOk = summary.down === 0 && summary.unchecked === 0;
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
            Fleet
          </p>
          <h3 className="mt-2 text-lg font-semibold tracking-tight">
            {allOk ? "All sites healthy" : "Mostly healthy"}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {summary.total} site{summary.total === 1 ? "" : "s"} watched ·
            checks every 5 minutes.
          </p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success ring-1 ring-inset ring-success/30">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat
          icon={CheckCircle2}
          tone="success"
          value={summary.healthy}
          label="Healthy"
        />
        <Stat
          icon={AlertCircle}
          tone="signal"
          value={summary.down}
          label="Down"
        />
        <Stat
          icon={MinusCircle}
          tone="muted"
          value={summary.unchecked}
          label="Unchecked"
        />
      </dl>

      <Link
        href="/fleet"
        className="mt-5 inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
      >
        Open Fleet
        <ArrowRight className="h-3 w-3" />
      </Link>
    </section>
  );
}

function Stat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "signal" | "muted";
  value: number;
  label: string;
}) {
  const color = {
    success: "text-success",
    signal: "text-signal",
    muted: "text-muted",
  }[tone];
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="font-mono text-base font-medium text-foreground">
          {value}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          {label}
        </p>
      </div>
    </div>
  );
}
