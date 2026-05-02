import type { Metadata } from "next";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Archive,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getOrCreateMyReferralCode,
  listMyReferrals,
} from "@/server/referrals";
import { site } from "@/lib/site";
import { formatRelativeAgo } from "@/lib/time";
import { ShareLinkBar } from "@/components/dashboard/share-link-bar";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Refer a friend",
  description:
    "Send a colleague a free trial of The Code Doctors. They get 14 days, you get our gratitude.",
  robots: { index: false, follow: false },
};

export default async function ReferralsPage() {
  // getOrCreateMyReferralCode is idempotent; calling it on the server
  // here both retrieves and (on first ever view) generates the code.
  const code = await getOrCreateMyReferralCode();
  const referrals = await listMyReferrals();
  const trialUrl = `${site.url}/trial?ref=${code}`;
  const planUrl = `${site.url}/plans`;

  const activeCount = referrals.filter((r) => r.status === "active").length;
  const trialCount = referrals.filter(
    (r) => r.signupSource === "trial" && r.status === "active"
  ).length;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Refer a friend
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            Send a colleague a free trial
          </h1>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Anyone you send through your link gets a 14-day trial of
            General Care. We&apos;ll fix what their last scan flagged
            and ship the first treatment in week one. Your code stays
            yours forever.
          </p>
        </div>

        {/* The code + share bar */}
        <div className="mt-10 rounded-2xl border border-accent/30 bg-accent-soft/20 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Your code
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">
            {code}
          </p>
          <ShareLinkBar trialUrl={trialUrl} />
        </div>

        {/* Stats */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat icon={Sparkles} label="Sent" value={referrals.length} />
          <Stat
            icon={Clock}
            label="On trial"
            value={trialCount}
            sub="Inside the 14-day window"
          />
          <Stat
            icon={CheckCircle2}
            label="Active patients"
            value={activeCount}
            sub="Now under care"
          />
        </ul>

        {/* List */}
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Who you&apos;ve sent
          </h2>
          {referrals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm text-foreground">
                No referrals yet.
              </p>
              <p className="mt-1 text-xs text-muted">
                Share your link above. We&apos;ll show every sign-up
                that comes through it here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
              {referrals.map((r) => (
                <li
                  key={r.clientId}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-foreground">
                      {r.clientName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted">
                      <span>
                        Joined {formatRelativeAgo(r.joinedAt)}
                      </span>
                      <span>·</span>
                      <span>
                        {r.signupSource === "trial"
                          ? "Free trial"
                          : "Paid signup"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Footer note */}
        <p className="mt-12 text-center text-xs text-muted">
          Want to share a paid plan instead?{" "}
          <Link
            href={planUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            View plans
          </Link>{" "}
          and append <code className="font-mono">?ref={code}</code> to
          the URL.
        </p>
      </div>
    </Section>
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
  value: number;
  sub?: string;
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface/40 p-5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: {
      icon: CheckCircle2,
      label: "Active",
      cls: "bg-success/10 text-success ring-success/30",
    },
    lead: {
      icon: Clock,
      label: "Trying",
      cls: "bg-accent-soft text-accent ring-accent/30",
    },
    discharged: {
      icon: Archive,
      label: "Closed",
      cls: "bg-muted/10 text-muted ring-muted/20",
    },
  }[status] ?? {
    icon: Clock,
    label: status,
    cls: "bg-muted/10 text-muted ring-muted/20",
  };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
        config.cls
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

// Hint to the type checker that ArrowRight is used (it isn't directly,
// but referenced by the share-link-bar that uses an embedded version).
void ArrowRight;
