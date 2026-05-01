import {
  Activity,
  Globe,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeAgo } from "@/lib/time";
import {
  checkMySiteNow,
  setMyClientWebsiteUrl,
  latestCheckForClient,
  uptimeStatsForClient,
} from "@/server/health";
import { cn } from "@/lib/cn";

/**
 * Patient-side site uptime card. Renders four states:
 *   1. No website URL yet → inline form to set it
 *   2. URL set, no checks yet → "First check in a moment"
 *   3. URL set, last check ok → green status + 30d uptime + Refresh
 *   4. URL set, last check failed → red status with reason + Refresh
 */
export async function SiteUptimeCard({
  clientId,
  websiteUrl,
}: {
  clientId: string;
  websiteUrl: string | null;
}) {
  // No URL configured yet — show the configure form.
  if (!websiteUrl) {
    return <ConfigureUrlState />;
  }

  const [latest, stats] = await Promise.all([
    latestCheckForClient(clientId),
    uptimeStatsForClient(clientId),
  ]);

  // URL set but no checks recorded yet
  if (!latest) {
    return (
      <Card>
        <CardHeader
          icon={Globe}
          eyebrow="Site uptime"
          title="Monitoring set up"
          tone="accent"
        />
        <p className="mt-3 text-sm text-muted">
          We&apos;ll run the first check shortly. Refresh in a minute or two
          to see your current status.
        </p>
        <p className="mt-2 font-mono text-xs text-muted">{websiteUrl}</p>
        <div className="mt-5">
          <RefreshButton />
        </div>
      </Card>
    );
  }

  const ok = latest.ok;
  const ratioPct =
    stats.uptimeRatio === null ? null : Math.round(stats.uptimeRatio * 1000) / 10;

  return (
    <Card>
      <CardHeader
        icon={ok ? CheckCircle2 : AlertCircle}
        eyebrow="Site uptime"
        title={ok ? "Up" : "Site is down"}
        tone={ok ? "success" : "signal"}
      />
      <p className="mt-2 font-mono text-xs text-muted truncate" title={latest.url}>
        {latest.url}
      </p>

      {!ok && latest.error && (
        <p className="mt-3 rounded-md border border-signal/30 bg-signal/5 px-3 py-2 text-sm text-foreground">
          {latest.error}
        </p>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
            Last check
          </dt>
          <dd className="mt-1 text-foreground">
            {formatRelativeAgo(latest.checkedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
            Response
          </dt>
          <dd className="mt-1 font-mono text-foreground">
            {latest.responseTimeMs ? `${latest.responseTimeMs}ms` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-mono uppercase tracking-[0.16em] text-muted">
            30-day uptime
          </dt>
          <dd className="mt-1 font-mono text-foreground">
            {ratioPct !== null ? `${ratioPct.toFixed(1)}%` : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex items-center gap-3">
        <RefreshButton />
        <p className="text-xs text-muted">
          Continuous monitoring runs in the background.
        </p>
      </div>
    </Card>
  );
}

function ConfigureUrlState() {
  return (
    <Card>
      <CardHeader
        icon={Activity}
        eyebrow="Site uptime"
        title="Tell us your site"
        tone="accent"
      />
      <p className="mt-3 text-sm text-muted">
        Add the URL we should watch and we&apos;ll start checking it
        every few minutes — and let you know the moment it goes down.
      </p>
      <form
        action={setMyClientWebsiteUrl}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <input
          type="url"
          name="url"
          required
          inputMode="url"
          autoComplete="url"
          placeholder="https://yoursite.com"
          className="flex-1 rounded-lg bg-background px-4 py-2.5 text-base text-foreground outline-none ring-1 ring-inset ring-border placeholder:text-muted focus:ring-accent"
        />
        <Button type="submit" variant="primary" size="md">
          Start watching
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted">
        You can change it anytime in settings.
      </p>
    </Card>
  );
}

function RefreshButton() {
  return (
    <form action={checkMySiteNow}>
      <button
        type="submit"
        className="inline-flex items-center gap-2 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <RefreshCw className="h-3 w-3" />
        Check now
      </button>
    </form>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-7">
      {children}
    </section>
  );
}

function CardHeader({
  icon: Icon,
  eyebrow,
  title,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  tone: "accent" | "success" | "signal";
}) {
  const ring = {
    accent: "bg-accent-soft text-accent ring-accent/30",
    success: "bg-success/10 text-success ring-success/30",
    signal: "bg-signal/10 text-signal ring-signal/30",
  }[tone];
  const eyebrowColor = {
    accent: "text-accent",
    success: "text-success",
    signal: "text-signal",
  }[tone];
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p
          className={cn(
            "font-mono text-[11px] uppercase tracking-[0.18em]",
            eyebrowColor
          )}
        >
          {eyebrow}
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
      </div>
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-xl ring-1 ring-inset",
          ring
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}
