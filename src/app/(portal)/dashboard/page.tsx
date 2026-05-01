import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowRight, Activity, FilePlus, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { listRequestsForCurrentUser } from "@/server/requests";
import {
  StatusPill,
  PriorityPill,
  TypeLabel,
} from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your treatment dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const recentRequests = (await listRequestsForCurrentUser()).slice(0, 5);

  return (
    <Section size="md" reveal={false}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Patient Portal
          </p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Hi {firstName}.
          </h1>
        </div>
        <Button href="/dashboard/requests/new" variant="primary" size="md">
          <Plus className="h-4 w-4" />
          New request
        </Button>
      </div>

      {recentRequests.length === 0 ? (
        <>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            <ActionCard
              icon={FilePlus}
              title="Submit a request"
              body="Tell us what's wrong or what you want changed. We'll triage and respond within a business day."
              cta="New request"
              href="/dashboard/requests/new"
            />
            <ActionCard
              icon={Activity}
              title="Site health"
              body="Lighthouse, uptime, security grade, SSL expiry — all in one view."
              cta="Coming soon"
              href="#"
              disabled
            />
            <ActionCard
              icon={MessageCircle}
              title="Messages"
              body="Reply on any request to message your assigned doctor directly."
              cta="View requests"
              href="/dashboard/requests"
            />
          </div>

          <div className="mt-16 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Empty state
            </p>
            <p className="mt-3 text-foreground">
              No active requests yet. Submit one to begin treatment.
            </p>
            <div className="mt-6">
              <Button
                href="/dashboard/requests/new"
                variant="primary"
                size="md"
              >
                Submit your first request
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
              Recent requests
            </h2>
            <Link
              href="/dashboard/requests"
              className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {recentRequests.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/requests/${r.id}`}
                  className="block px-6 py-5 transition-colors hover:bg-surface/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-medium text-foreground">
                        {r.title}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
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
        </div>
      )}
    </Section>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  href: string;
  disabled?: boolean;
}) {
  return (
    <div className="card-hover flex flex-col gap-4 rounded-2xl border border-border bg-surface/40 p-6">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      </div>
      <div className="mt-auto">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            {cta}
          </span>
        ) : (
          <Button href={href} variant="ghost" size="sm">
            {cta}
          </Button>
        )}
      </div>
    </div>
  );
}
