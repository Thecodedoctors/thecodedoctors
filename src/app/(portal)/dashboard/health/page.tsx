import type { Metadata } from "next";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { auth } from "@/auth";
import {
  latestCheckForClient,
  uptimeStatsForClient,
  recentChecksForCurrentUser,
  responseTimeSeriesForCurrentUser,
  checkMySiteNow,
  setMyClientWebsiteUrl,
} from "@/server/health";
import { getOrCreateClientForUser } from "@/lib/clients";
import { Button } from "@/components/ui/button";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Site health",
  robots: { index: false, follow: false },
};

export default async function SiteHealthPage() {
  const session = await auth();
  if (!session?.user) return null;

  const client = await getOrCreateClientForUser(session.user.id, {
    name: session.user.name,
    email: session.user.email,
  });

  // No URL yet — render the same configure form the hub uses.
  if (!client.websiteUrl) {
    return (
      <Section size="md" reveal={false}>
        <div className="mx-auto max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Site health
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Tell us your site, we&apos;ll watch it.
          </h1>
          <p className="mt-3 text-sm text-muted">
            Add your URL and we&apos;ll start checking it every few minutes
            — and let you know the moment it goes down.
          </p>

          <form
            action={setMyClientWebsiteUrl}
            className="mt-8 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              name="url"
              required
              inputMode="url"
              autoComplete="url"
              placeholder="yoursite.com"
              className="flex-1 rounded-lg bg-background px-4 py-2.5 text-base text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
            />
            <Button type="submit" variant="primary" size="md">
              Start watching
            </Button>
          </form>
        </div>
      </Section>
    );
  }

  const [latest, stats, recent, series] = await Promise.all([
    latestCheckForClient(client.id),
    uptimeStatsForClient(client.id),
    recentChecksForCurrentUser(50),
    responseTimeSeriesForCurrentUser(7),
  ]);

  const ratioPct =
    stats.uptimeRatio === null
      ? null
      : Math.round(stats.uptimeRatio * 1000) / 10;

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Site health
        </p>
        <h1 className="mt-2 flex items-baseline gap-3 text-3xl font-semibold tracking-tight md:text-4xl">
          {safeHost(client.websiteUrl)}
          {latest && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.14em] ring-1 ring-inset",
                latest.ok
                  ? "bg-success/10 text-success ring-success/30"
                  : "bg-signal/10 text-signal ring-signal/30"
              )}
            >
              {latest.ok ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {latest.ok ? "Up" : "Down"}
            </span>
          )}
        </h1>
        <a
          href={client.websiteUrl}
          target="_blank"
          rel="noopener noreferrer external"
          className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-muted underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          {client.websiteUrl}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Stat strip */}
      <div className="mt-8 grid gap-3 grid-cols-2 lg:grid-cols-4 rounded-2xl border border-border bg-surface/30 p-4">
        <Stat
          label="30-day uptime"
          value={ratioPct !== null ? `${ratioPct.toFixed(1)}%` : "—"}
          sub={
            stats.total > 0
              ? `${stats.total} checks · ${stats.down} down`
              : "Building history…"
          }
        />
        <Stat
          label="Avg response"
          value={
            stats.avgResponseMs > 0 ? `${stats.avgResponseMs}ms` : "—"
          }
          sub="Last 30 days · OK checks only"
        />
        <Stat
          label="Last check"
          value={latest ? formatRelativeAgo(latest.checkedAt) : "—"}
          sub={latest?.responseTimeMs ? `${latest.responseTimeMs}ms` : "—"}
        />
        <Stat
          label="Status"
          value={latest ? (latest.ok ? "OK" : "Failing") : "Pending"}
          sub={latest?.error ?? "Continuous monitoring"}
        />
      </div>

      {/* Manual check */}
      <div className="mt-6 flex items-center gap-3">
        <form action={checkMySiteNow}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Check now
          </button>
        </form>
        <p className="text-xs text-muted">
          Continuous monitoring runs every ~5 minutes in the background.
        </p>
      </div>

      {/* Response time chart */}
      <section className="mt-12">
        <div className="mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Response time
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">
            Average response per day, last 7 days
          </h2>
        </div>
        <div className="rounded-2xl border border-border bg-surface/40 p-6">
          <ResponseTimeChart series={series} />
        </div>
      </section>

      {/* Change URL */}
      <section className="mt-8">
        <div className="mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Change site URL
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight">
            Update the URL we monitor
          </h2>
          <p className="mt-1 text-xs text-muted">
            We&apos;ll switch monitoring to the new URL and run a first check
            immediately. Existing history stays in your check log.
          </p>
        </div>
        <form
          action={setMyClientWebsiteUrl}
          className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/40 p-4 sm:flex-row"
        >
          <input
            type="text"
            name="url"
            required
            inputMode="url"
            autoComplete="url"
            defaultValue={client.websiteUrl}
            className="flex-1 rounded-lg bg-background px-3 py-2 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
          />
          <Button type="submit" variant="primary" size="sm">
            Update URL
          </Button>
        </form>
      </section>

      {/* Check log */}
      <section className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Check log
            </p>
            <h2 className="mt-1 text-base font-semibold tracking-tight">
              Last {recent.length} check{recent.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
            No checks recorded yet — first one will land within a few
            minutes.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {recent.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-4 px-5 py-3 text-sm"
              >
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                    c.ok
                      ? "bg-success/10 text-success ring-success/30"
                      : "bg-signal/10 text-signal ring-signal/30"
                  )}
                >
                  {c.ok ? (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  ) : (
                    <AlertCircle className="h-2.5 w-2.5" />
                  )}
                  {c.ok ? "OK" : "Failed"}
                </span>
                <span className="font-mono text-xs text-muted shrink-0">
                  {c.statusCode ?? "—"}
                </span>
                <span className="font-mono text-xs text-foreground shrink-0 w-16">
                  {c.responseTimeMs !== null ? `${c.responseTimeMs}ms` : "—"}
                </span>
                <span className="flex-1 text-xs text-muted truncate">
                  {c.error ?? (c.ok ? "Healthy" : "—")}
                </span>
                <time
                  className="font-mono text-xs text-muted shrink-0"
                  title={formatAbsolute(c.checkedAt)}
                >
                  {formatRelativeAgo(c.checkedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="px-2 py-1">
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted truncate">{sub}</p>
    </div>
  );
}

function ResponseTimeChart({
  series,
}: {
  series: {
    day: Date;
    label: string;
    avgMs: number;
    okChecks: number;
    failedChecks: number;
  }[];
}) {
  const max = Math.max(1, ...series.map((s) => s.avgMs));

  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {series.map((s) => {
          const pct = (s.avgMs / max) * 100;
          const hasFailures = s.failedChecks > 0;
          return (
            <div
              key={s.label}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div className="absolute -top-7 hidden text-center group-hover:block">
                <span className="rounded bg-foreground/90 px-1.5 py-0.5 font-mono text-[10px] text-background whitespace-nowrap">
                  {s.avgMs > 0 ? `${s.avgMs}ms` : "no data"}
                  {s.okChecks + s.failedChecks > 0
                    ? ` · ${s.okChecks + s.failedChecks} checks`
                    : ""}
                  {hasFailures ? ` · ${s.failedChecks} failed` : ""}
                </span>
              </div>
              <div
                className={cn(
                  "w-full rounded-t-sm transition-all",
                  s.avgMs === 0
                    ? "bg-border"
                    : hasFailures
                      ? "bg-signal"
                      : "bg-accent"
                )}
                style={{
                  height: `${pct}%`,
                  minHeight: s.avgMs > 0 ? "4px" : "2px",
                }}
                aria-label={`${s.label}: ${s.avgMs}ms`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {series.map((s) => (
          <span
            key={s.label}
            className="flex-1 text-center font-mono text-[10px] text-muted"
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
