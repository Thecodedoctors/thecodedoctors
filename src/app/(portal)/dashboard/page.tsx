import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus,
  ArrowRight,
  Activity,
  ShieldCheck,
  CreditCard,
  HeartPulse,
  Sparkles,
  BookOpen,
  Mail,
  Lock,
} from "lucide-react";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { listRequestsForCurrentUser } from "@/server/requests";
import {
  activityForCurrentUser,
  latestScanForCurrentUser,
} from "@/server/activity";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { cn } from "@/lib/cn";
import { getOrCreateClientForUser } from "@/lib/clients";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your treatment dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [client, allRequests, activity, lastScan] = await Promise.all([
    getOrCreateClientForUser(session.user.id, {
      name: session.user.name,
      email: session.user.email,
    }),
    listRequestsForCurrentUser(),
    activityForCurrentUser(8),
    latestScanForCurrentUser(),
  ]);

  const open = allRequests.filter(
    (r) => r.status !== "healed" && r.status !== "closed"
  ).length;
  const inTreatment = allRequests.filter(
    (r) => r.status === "in_treatment" || r.status === "in_review"
  ).length;
  const healed = allRequests.filter((r) => r.status === "healed").length;
  const lastReplyTs = activity.find((a) => a.kind === "message_received")?.ts;

  const recent = allRequests.slice(0, 5);

  return (
    <Section size="md" reveal={false} className="!py-12 md:!py-14">
      {/* Welcome banner */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Patient Portal
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Hi {firstName}.
          </h1>
          <p className="mt-2 text-base text-muted">
            {open === 0
              ? "Inbox is clear. Great place to be."
              : `You have ${open} open request${open === 1 ? "" : "s"}${
                  inTreatment ? ` · ${inTreatment} in treatment` : ""
                }.`}
          </p>
        </div>
        <Button href="/requests/new" variant="primary" size="md">
          <Plus className="h-4 w-4" />
          New request
        </Button>
      </div>

      {/* Stat strip */}
      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Open requests"
          value={open}
          icon={Activity}
          tone="accent"
        />
        <StatCard
          label="In treatment"
          value={inTreatment}
          icon={HeartPulse}
          tone="warning"
        />
        <StatCard
          label="Healed"
          value={healed}
          icon={Sparkles}
          tone="success"
        />
        <StatCard
          label="Last reply"
          value={lastReplyTs ? formatRelativeShort(lastReplyTs) : "—"}
          icon={Mail}
          tone="muted"
        />
        <StatCard
          label="Site health"
          value={lastScan ? `${lastScan.overallScore}/100` : "—"}
          subtitle={lastScan ? lastScan.overallGrade : "Run a checkup"}
          icon={ShieldCheck}
          tone={lastScan ? (lastScan.overallScore >= 80 ? "success" : "warning") : "muted"}
        />
      </ul>

      {/* Two-column main */}
      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        {/* Recent requests — left, wider */}
        <div className="lg:col-span-7">
          <PanelHeader
            title="Recent requests"
            href="/requests"
            cta="View all"
          />
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
                Empty
              </p>
              <p className="mt-3 text-foreground">
                Submit your first request to begin treatment.
              </p>
              <div className="mt-6">
                <Button href="/requests/new" variant="primary" size="md">
                  Submit a request
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/requests/${r.id}`}
                    className="block px-5 py-4 transition-colors hover:bg-surface/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-foreground">
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

        {/* Activity feed — right */}
        <div className="lg:col-span-5">
          <PanelHeader title="Recent activity" />
          <ActivityFeed items={activity} variant="client" />
        </div>
      </div>

      {/* Site health + Plan & Care */}
      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-border bg-surface/40 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Site health
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {lastScan
                  ? `${lastScan.overallScore}/100 · grade ${lastScan.overallGrade}`
                  : "Not scanned yet"}
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted">
                {lastScan ? (
                  <>
                    Last scan of{" "}
                    <span className="font-mono text-foreground">
                      {new URL(lastScan.url).hostname}
                    </span>{" "}
                    on{" "}
                    {lastScan.scannedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    . Continuous monitoring + Lighthouse-over-time graphs land
                    in our next release.
                  </>
                ) : (
                  <>
                    Run a free checkup to capture a baseline. Continuous
                    monitoring (Lighthouse over time, uptime, security grade,
                    SSL expiry) ships in the next release.
                  </>
                )}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6">
            <Button href="/checkup" variant="secondary" size="md">
              {lastScan ? "Run a fresh checkup" : "Run a free checkup"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-border bg-surface/40 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Care plan
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {planLabel(client.plan)}
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted">
                {client.plan === "checkup"
                  ? "Single checkup · upgrade to General or Premium Care for ongoing monitoring."
                  : "Active monthly care."}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3 w-3" />
            Self-service billing in our next release. To change plans now,
            reply on any request.
          </div>
        </div>
      </div>

      {/* Knowledge base + Contact */}
      <div className="mt-10 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-border bg-surface/40 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Knowledge base
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                Articles, tips, and FAQs
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted">
                Plain-language explainers on what we&apos;re fixing and why —
                from HSTS to Core Web Vitals. Library opens in our next release.
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <BookOpen className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-border-strong bg-accent-soft/30 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Need a doctor?
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                Reach us anytime.
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted">
                The fastest path is to submit a request — that opens a thread
                with your doctor and lives in your file.
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-background">
              <Mail className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6">
            <Button href="/requests/new" variant="primary" size="md">
              Talk to a doctor
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = "accent",
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "accent" | "warning" | "success" | "muted";
}) {
  const toneClasses: Record<typeof tone & string, string> = {
    accent: "text-accent bg-accent-soft ring-accent/20",
    warning: "text-warning bg-warning/10 ring-warning/30",
    success: "text-success bg-success/10 ring-success/30",
    muted: "text-muted bg-muted/10 ring-muted/20",
  };
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-5">
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset",
          toneClasses[tone]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {subtitle && (
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {subtitle}
          </p>
        )}
      </div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
    </li>
  );
}

function PanelHeader({
  title,
  href,
  cta,
}: {
  title: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
        {title}
      </h2>
      {href && cta && (
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
        >
          {cta} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return "Custom plan";
}

function formatRelativeShort(d: Date): string {
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
