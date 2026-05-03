import type { Metadata } from "next";
import Link from "next/link";
import {
  KeyRound,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Archive,
  AlertCircle,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { listCredentialRequestsForCurrentUser } from "@/server/credentials";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Credentials",
  robots: { index: false, follow: false },
};

const STATE_CONFIG = {
  open: {
    label: "Action needed",
    cls: "bg-warning/10 text-warning ring-warning/30",
    icon: AlertCircle,
  },
  submitted: {
    label: "Submitted",
    cls: "bg-success/10 text-success ring-success/30",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    cls: "bg-muted/10 text-muted ring-muted/20",
    icon: Archive,
  },
} as const;

export default async function PatientCredentialsPage() {
  const requests = await listCredentialRequestsForCurrentUser();
  const open = requests.filter((r) => r.state === "open");

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Credentials
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {open.length === 0
            ? "Nothing waiting on you"
            : `${open.length} thing${open.length === 1 ? "" : "s"} we need from you`}
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          When your doctor needs sensitive things — hosting login, registrar
          access, an API key — they show up here. What you submit is encrypted
          on our servers; only the founder can read it, every read is logged,
          and once we&apos;re done we wipe the values.
        </p>

        {/* Trust strip */}
        <div className="mt-6 rounded-2xl border border-border bg-surface/30 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="text-sm text-foreground">
              <p>
                <span className="text-foreground">After you submit, you
                  can&apos;t see your own values back.
                </span>{" "}
                <span className="text-muted">
                  We treat creds like one-way deposits — better than us
                  showing you what you typed and risking it leaking through
                  email or a screenshot.
                </span>
              </p>
            </div>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted/10 text-muted ring-1 ring-inset ring-muted/20">
              <KeyRound className="h-5 w-5" />
            </span>
            <p className="mt-4 text-sm text-foreground">
              No credential requests yet.
            </p>
            <p className="mt-1 text-xs text-muted">
              You&apos;ll see them here the moment your doctor needs
              something.
            </p>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
            {requests.map((r) => {
              const cfg = STATE_CONFIG[r.state];
              const Icon = cfg.icon;
              return (
                <li key={r.id}>
                  <Link
                    href={`/credentials/${r.id}`}
                    className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-surface/80"
                  >
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                        cfg.cls
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-base font-medium text-foreground">
                          {r.title}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
                            cfg.cls
                          )}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        Asked {formatRelativeAgo(r.createdAt)}
                        {r.requestedByName && <> · {r.requestedByName}</>}
                        {r.submittedAt && (
                          <> · sent {formatRelativeAgo(r.submittedAt)}</>
                        )}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Section>
  );
}
