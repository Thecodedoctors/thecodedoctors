import Link from "next/link";
import { AlertCircle, ArrowRight, ExternalLink } from "lucide-react";
import { formatRelativeAgo } from "@/lib/time";
import type { FleetSummary } from "@/server/health";

/**
 * Loud red banner shown on the staff home when ANY client site is down.
 * Renders nothing when the fleet is healthy. Lists up to 3 down sites
 * inline so a doctor can see the scope without leaving the page.
 */
export function FleetAlertStrip({ summary }: { summary: FleetSummary }) {
  if (summary.down === 0) return null;

  const visible = summary.downSites.slice(0, 3);
  const overflow = summary.downSites.length - visible.length;

  return (
    <section className="mt-8 rounded-2xl border border-signal/40 bg-signal/5 p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-signal text-background">
          <AlertCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
            Fleet alert
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            {summary.down} {summary.down === 1 ? "site is" : "sites are"} down
          </h2>
          <ul className="mt-3 space-y-2">
            {visible.map((site) => (
              <li
                key={site.clientId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-signal/20 bg-background/40 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    {site.clientName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {site.error ?? "Unreachable"} · since{" "}
                    {formatRelativeAgo(site.since)}
                  </p>
                </div>
                <a
                  href={site.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer external"
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted underline decoration-border-strong underline-offset-4 hover:decoration-signal"
                >
                  {new URL(site.websiteUrl).hostname}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
            {overflow > 0 && (
              <li className="text-xs text-muted">
                + {overflow} more — open Fleet for the full list.
              </li>
            )}
          </ul>
          <Link
            href="/fleet"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-signal px-4 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-90"
          >
            Open Fleet
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
