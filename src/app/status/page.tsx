import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, AlertCircle, Activity, Clock } from "lucide-react";
import { Logo } from "@/components/logo";
import { listOpenIncidents, listRecentIncidents } from "@/server/incidents";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Status — ${site.name}`,
  description:
    "Live operational status and recent incidents for The Code Doctors.",
};

// Status reads from the live DB on every visit — it MUST not be
// prerendered at build time (the build sandbox has no DATABASE_URL).
export const dynamic = "force-dynamic";

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    cls: "bg-signal/10 text-signal ring-signal/30",
  },
  major: {
    label: "Major",
    cls: "bg-warning/10 text-warning ring-warning/30",
  },
  minor: {
    label: "Minor",
    cls: "bg-muted/10 text-muted ring-muted/20",
  },
} as const;

export default async function StatusPage() {
  const [open, recent] = await Promise.all([
    listOpenIncidents(),
    listRecentIncidents(),
  ]);

  const tone = open.length === 0 ? "ok" : worstSeverity(open);
  const headline = open.length === 0
    ? "All systems operational"
    : tone === "critical"
      ? "Major outage in progress"
      : tone === "major"
        ? "Partial outage in progress"
        : "Degraded service";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" aria-label={`${site.name} home`}>
            <Logo size={20} />
          </Link>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Status
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Headline tone={tone} headline={headline} />

        {open.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-signal">
              Ongoing
            </h2>
            <ul className="space-y-3">
              {open.map((i) => (
                <IncidentCard key={i.id} incident={i} ongoing />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Recent history
          </h2>
          {recent.filter((i) => i.resolvedAt).length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
              No resolved incidents in the last 90 days.
            </p>
          ) : (
            <ul className="space-y-3">
              {recent
                .filter((i) => i.resolvedAt)
                .map((i) => (
                  <IncidentCard key={i.id} incident={i} ongoing={false} />
                ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 border-t border-border/60 pt-8">
          <p className="text-xs text-muted">
            See something we&apos;re missing? Email{" "}
            <a
              href={`mailto:${site.emails.general}`}
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              {site.emails.general}
            </a>
            . For security issues, see{" "}
            <Link
              href="/.well-known/security.txt"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              security.txt
            </Link>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Headline({
  tone,
  headline,
}: {
  tone: "ok" | "critical" | "major" | "minor";
  headline: string;
}) {
  const cfg =
    tone === "ok"
      ? {
          icon: CheckCircle2,
          ring: "bg-success/10 text-success ring-success/30",
          eyebrow: "Operational",
          eyebrowCls: "text-success",
        }
      : tone === "critical"
        ? {
            icon: AlertCircle,
            ring: "bg-signal/10 text-signal ring-signal/30",
            eyebrow: "Outage",
            eyebrowCls: "text-signal",
          }
        : tone === "major"
          ? {
              icon: AlertCircle,
              ring: "bg-warning/10 text-warning ring-warning/30",
              eyebrow: "Partial outage",
              eyebrowCls: "text-warning",
            }
          : {
              icon: Activity,
              ring: "bg-warning/10 text-warning ring-warning/30",
              eyebrow: "Degraded",
              eyebrowCls: "text-warning",
            };
  const Icon = cfg.icon;
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${cfg.ring}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.18em] ${cfg.eyebrowCls}`}
          >
            {cfg.eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {headline}
          </h1>
          <p className="mt-3 text-sm text-muted">
            This page reflects the live state of {site.name} services. Patient
            sites have their own monitoring; ask your doctor if you need a
            site-specific status.
          </p>
        </div>
      </div>
    </section>
  );
}

function IncidentCard({
  incident,
  ongoing,
}: {
  incident: import("@/server/incidents").IncidentRow;
  ongoing: boolean;
}) {
  const sev = SEVERITY_CONFIG[incident.severity];
  return (
    <li className="rounded-2xl border border-border bg-surface/30 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold tracking-tight">
            {incident.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset ${sev.cls}`}
          >
            {sev.label}
          </span>
        </div>
        <p className="font-mono text-[11px] text-muted">
          <Clock className="mr-1 inline h-3 w-3" />
          {ongoing ? (
            <>Started {formatRelativeAgo(incident.startedAt)}</>
          ) : (
            <span title={formatAbsolute(incident.resolvedAt!)}>
              Resolved {formatRelativeAgo(incident.resolvedAt!)}
            </span>
          )}
        </p>
      </div>
      {incident.body && (
        <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
          {incident.body}
        </pre>
      )}
    </li>
  );
}

function worstSeverity(
  list: import("@/server/incidents").IncidentRow[]
): "critical" | "major" | "minor" {
  if (list.some((i) => i.severity === "critical")) return "critical";
  if (list.some((i) => i.severity === "major")) return "major";
  return "minor";
}
