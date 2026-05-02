import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  CreditCard,
  Stethoscope,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeAgo } from "@/lib/time";
import {
  checkMySiteNow,
  setMyClientWebsiteUrl,
  latestCheckForClient,
  uptimeStatsForClient,
} from "@/server/health";

/**
 * Top-of-hub hero — the answer to the patient's three implicit questions:
 *   • is my site up?
 *   • when did our doctors last touch it?
 *   • what plan am I on?
 *
 * Renders three states:
 *   1. No website URL configured → inline "tell us your site" form
 *   2. URL set, no checks yet → "first check pending"
 *   3. URL set with at least one check → status badge + 3-stat strip
 */
export async function SiteAtAGlance({
  clientId,
  websiteUrl,
  plan,
  lastTreatmentAt,
}: {
  clientId: string;
  websiteUrl: string | null;
  plan: string;
  lastTreatmentAt: Date | null;
}) {
  // 1. No URL yet — bootstrap form
  if (!websiteUrl) {
    return (
      <section className="mt-8 rounded-2xl border border-border-strong bg-surface/40 p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              Set up monitoring
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              Tell us your site, we&apos;ll watch it.
            </h3>
            <p className="mt-2 text-sm text-muted">
              Add the URL and we&apos;ll start checking every few minutes —
              and ping you the moment it goes down.
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
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
          <Stat
            icon={CreditCard}
            label="Plan"
            value={planLabel(plan)}
          />
          <Stat
            icon={Stethoscope}
            label="Last treatment"
            value={
              lastTreatmentAt ? formatRelativeAgo(lastTreatmentAt) : "—"
            }
            sub={lastTreatmentAt ? null : "No completed requests yet"}
          />
        </div>
      </section>
    );
  }

  const [latest, stats] = await Promise.all([
    latestCheckForClient(clientId),
    uptimeStatsForClient(clientId),
  ]);

  const ratioPct =
    stats.uptimeRatio === null
      ? null
      : Math.round(stats.uptimeRatio * 1000) / 10;
  const host = safeHost(websiteUrl);

  // 2. URL set, no checks yet
  if (!latest) {
    return (
      <section className="mt-8 rounded-2xl border border-border-strong bg-surface/40 p-7">
        <SiteHeader
          host={host}
          url={websiteUrl}
          tone="accent"
          icon={Globe}
          eyebrow="Monitoring set up"
          status="First check in a moment…"
        />
        <StatStrip
          plan={plan}
          lastTreatmentAt={lastTreatmentAt}
          uptimeText="—"
          uptimeSub="Pending first check"
        />
        <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
          <RefreshButton />
          <p className="text-xs text-muted">Refresh in a minute or two.</p>
        </div>
      </section>
    );
  }

  // 3. URL set + at least one check
  const ok = latest.ok;
  return (
    <section
      className={
        ok
          ? "mt-8 rounded-2xl border border-border-strong bg-surface/40 p-7"
          : "mt-8 rounded-2xl border border-signal/40 bg-signal/5 p-7"
      }
    >
      <SiteHeader
        host={host}
        url={websiteUrl}
        tone={ok ? "success" : "signal"}
        icon={ok ? CheckCircle2 : AlertCircle}
        eyebrow={ok ? "Site is up" : "Site is down"}
        status={
          ok
            ? `${latest.responseTimeMs ? `${latest.responseTimeMs}ms` : "Healthy"} · checked ${formatRelativeAgo(latest.checkedAt)}`
            : `${latest.error ?? "Unreachable"} · checked ${formatRelativeAgo(latest.checkedAt)}`
        }
      />
      <StatStrip
        plan={plan}
        lastTreatmentAt={lastTreatmentAt}
        uptimeText={ratioPct !== null ? `${ratioPct.toFixed(1)}%` : "—"}
        uptimeSub={
          stats.total > 0
            ? `${stats.total} checks · ${stats.down} down`
            : "Building history…"
        }
      />
      <div className="mt-5 flex items-center gap-3 border-t border-border pt-5">
        <RefreshButton />
        <p className="text-xs text-muted">
          Continuous monitoring runs in the background.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function SiteHeader({
  host,
  url,
  tone,
  icon: Icon,
  eyebrow,
  status,
}: {
  host: string;
  url: string;
  tone: "accent" | "success" | "signal";
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  status: string;
}) {
  const eyebrowColor = {
    accent: "text-accent",
    success: "text-success",
    signal: "text-signal",
  }[tone];
  const ring = {
    accent: "bg-accent-soft text-accent ring-accent/30",
    success: "bg-success/10 text-success ring-success/30",
    signal: "bg-signal/10 text-signal ring-signal/30",
  }[tone];
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p
          className={`font-mono text-[11px] uppercase tracking-[0.18em] ${eyebrowColor}`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight md:text-3xl">
          {host}
        </h2>
        <p className="mt-2 text-sm text-muted">{status}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer external"
          className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-muted underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          {url}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <span
        className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${ring}`}
      >
        <Icon className="h-5 w-5" />
      </span>
    </div>
  );
}

function StatStrip({
  plan,
  lastTreatmentAt,
  uptimeText,
  uptimeSub,
}: {
  plan: string;
  lastTreatmentAt: Date | null;
  uptimeText: string;
  uptimeSub: string | null;
}) {
  return (
    <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
      <Stat icon={CreditCard} label="Plan" value={planLabel(plan)} />
      <Stat
        icon={Stethoscope}
        label="Last treatment"
        value={lastTreatmentAt ? formatRelativeAgo(lastTreatmentAt) : "—"}
        sub={lastTreatmentAt ? null : "No completed requests yet"}
      />
      <Stat icon={Activity} label="30-day uptime" value={uptimeText} sub={uptimeSub} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-muted ring-1 ring-inset ring-border">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {label}
        </p>
        <p className="mt-1 text-base font-medium text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
    </div>
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

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return "Custom plan";
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
