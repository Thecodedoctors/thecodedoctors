import type { Metadata } from "next";
import { auth } from "@/auth";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Activity, FilePlus, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your treatment dashboard.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  return (
    <Section size="md" reveal={false}>
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Patient Portal
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-5xl">
          Hi {firstName}.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Welcome to your treatment dashboard. Submit improvement requests,
          track their status, and message your doctor — all in one place.
        </p>
      </div>

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
          body="Lighthouse score, uptime, security grade, and SSL expiry in one view."
          cta="View vitals"
          href="/dashboard/health"
        />
        <ActionCard
          icon={MessageCircle}
          title="Message your doctor"
          body="A direct line to whoever is treating your site this week."
          cta="Open inbox"
          href="/dashboard/messages"
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
          <Button href="/dashboard/requests/new" variant="primary" size="md">
            Submit your first request
          </Button>
        </div>
      </div>
    </Section>
  );
}

function ActionCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: string;
  href: string;
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
        <Button href={href} variant="ghost" size="sm">
          {cta}
        </Button>
      </div>
    </div>
  );
}
