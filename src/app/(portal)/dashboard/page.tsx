import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  BookOpen,
  Mail,
  Lock,
  MessageCircle,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  listRequestsForCurrentUser,
  needsYourReplyForCurrentUser,
  inProgressForCurrentUser,
} from "@/server/requests";
import { latestScanForCurrentUser } from "@/server/activity";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";
import { getOrCreateClientForUser } from "@/lib/clients";

export const metadata: Metadata = {
  title: "Hub",
  description: "Your treatment hub.",
  robots: { index: false, follow: false },
};

export default async function HubPage() {
  const session = await auth();
  if (!session?.user) return null;

  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [client, allRequests, needsReply, inProgress, lastScan] = await Promise.all([
    getOrCreateClientForUser(session.user.id, {
      name: session.user.name,
      email: session.user.email,
    }),
    listRequestsForCurrentUser(),
    needsYourReplyForCurrentUser(),
    inProgressForCurrentUser(),
    latestScanForCurrentUser(),
  ]);

  const open = allRequests.filter(
    (r) => r.status !== "healed" && r.status !== "closed"
  ).length;
  const resolved = allRequests.filter((r) => r.status === "healed").length;
  const totalActive = needsReply.length + inProgress.length;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-10 md:px-10 md:py-12">
      {/* Welcome banner */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Patient Portal
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Hi {firstName}.
          </h1>
          <p className="mt-2 text-base text-muted">
            {totalActive === 0
              ? open === 0
                ? "Inbox is clear. Submit a request when something needs a doctor."
                : `${open} open request${open === 1 ? "" : "s"} · nothing waiting on you.`
              : needsReply.length > 0
                ? `${needsReply.length} request${needsReply.length === 1 ? "" : "s"} ${needsReply.length === 1 ? "needs" : "need"} your reply.`
                : `${inProgress.length} in progress.`}
          </p>
        </div>
        <Button href="/requests/new" variant="primary" size="md">
          <Plus className="h-4 w-4" />
          New request
        </Button>
      </header>

      {/* Needs your reply — the headline panel */}
      {needsReply.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              Needs your reply
            </h2>
            <p className="text-xs text-muted">
              {needsReply.length} item{needsReply.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="space-y-3">
            {needsReply.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/requests/${r.id}`}
                  className="group block rounded-2xl border border-accent/30 bg-accent-soft/30 p-5 transition-colors hover:border-accent/60 hover:bg-accent-soft/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5 mb-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                          <MessageCircle className="h-3 w-3" />
                          Doctor replied · {formatRelativeAgo(r.lastReplyAt)}
                        </span>
                        <span className="text-muted">·</span>
                        <PriorityPill priority={r.priority} />
                      </div>
                      <h3 className="text-base font-medium text-foreground">
                        {r.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted line-clamp-2">
                        {r.lastReplyPreview}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent text-background px-3 py-1.5 text-xs font-medium transition-transform group-hover:translate-x-0.5">
                      Reply
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              In progress
            </h2>
            <p className="text-xs text-muted">
              {inProgress.length} item{inProgress.length === 1 ? "" : "s"}
            </p>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {inProgress.map((r) => (
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
                        <span className="text-muted">·</span>
                        <span className="font-mono text-xs text-muted">
                          Updated {formatRelativeAgo(r.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Empty state — only if NO active items at all */}
      {needsReply.length === 0 && inProgress.length === 0 && (
        <section className="mt-12 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Quiet
          </p>
          <p className="mt-3 max-w-md mx-auto text-foreground">
            {open === 0
              ? "No requests yet. Submit one when something on your site needs a doctor's attention."
              : "Nothing waiting on you right now. We'll let you know if that changes."}
          </p>
          <div className="mt-6">
            <Button href="/requests/new" variant="primary" size="md">
              <Plus className="h-4 w-4" />
              {open === 0 ? "Submit your first request" : "Submit another request"}
            </Button>
          </div>
        </section>
      )}

      {/* Stat strip — demoted, not the headline */}
      <section className="mt-12 grid gap-3 grid-cols-2 sm:grid-cols-4 rounded-2xl border border-border bg-surface/30 p-4">
        <Stat label="Open" value={open} />
        <Stat label="In progress" value={inProgress.length} />
        <Stat label="Resolved" value={resolved} />
        <Stat
          label="Site health"
          value={lastScan ? `${lastScan.overallScore}` : "—"}
          suffix={lastScan ? `/100` : ""}
        />
      </section>

      {/* Secondary cards: Site Health + Care Plan */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface/40 p-7">
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
                {lastScan
                  ? `Last checkup of ${new URL(lastScan.url).hostname} ${formatRelativeAgo(lastScan.scannedAt)}. Continuous monitoring is on the way.`
                  : "Run a free checkup to capture a baseline. Continuous monitoring lands in our next release."}
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

        <div className="rounded-2xl border border-border bg-surface/40 p-7">
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
                  ? "Single checkup. Upgrade to General or Premium Care for ongoing monitoring."
                  : "Active monthly care."}
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <CreditCard className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3 w-3" />
            Self-service billing in our next release. To change plans now, reply on any request.
          </div>
        </div>
      </div>

      {/* Knowledge base + Contact */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface/40 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Knowledge base
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                Articles, tips, and FAQs
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted">
                Plain-language explainers on what we&apos;re fixing and why — from HSTS to Core Web Vitals. Library opens in our next release.
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <BookOpen className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-strong bg-accent-soft/30 p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Need a doctor?
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                Reach us anytime.
              </h3>
              <p className="mt-2 max-w-sm text-sm text-muted">
                The fastest path is to submit a request — that opens a thread with your doctor and lives in your file.
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

    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 px-2 py-1")}>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="font-mono text-xl font-semibold tracking-tight text-foreground">
        {value}
        {suffix && <span className="text-muted text-sm">{suffix}</span>}
      </p>
    </div>
  );
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return "Custom plan";
}
