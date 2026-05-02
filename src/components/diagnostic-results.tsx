"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import {
  Activity,
  ShieldCheck,
  Search,
  Globe,
  Eye,
  Gauge,
  Mail,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import type {
  CheckupReport,
  CheckResult,
  Status,
  Severity,
  Finding,
} from "@/lib/checkup/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  transport: Globe,
  "security-headers": ShieldCheck,
  seo: Search,
  dns: Mail,
  privacy: Eye,
  performance: Gauge,
};

const STATUS_TONE: Record<Status, string> = {
  healthy: "text-success",
  "needs-attention": "text-warning",
  critical: "text-signal",
};

export function DiagnosticResults({
  report,
  onScanAnother,
}: {
  report: CheckupReport;
  onScanAnother: () => void;
}) {
  return (
    <div className="space-y-5">
      <OverallCard report={report} />
      <motion.ul
        className="grid gap-3 md:grid-cols-2"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.07, delayChildren: 0.4 } },
        }}
      >
        {report.checks.map((c) => (
          <motion.li
            key={c.id}
            variants={{
              hidden: { opacity: 0, y: 16 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <CheckCard check={c} />
          </motion.li>
        ))}
      </motion.ul>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <EmailGate report={report} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="flex items-center justify-between gap-4 pt-2"
      >
        <p className="text-xs text-muted">
          Scanned in {(report.durationMs / 1000).toFixed(1)}s ·{" "}
          {new Date(report.scannedAt).toLocaleString()}
        </p>
        <Button onClick={onScanAnother} variant="ghost" size="sm">
          Scan another
        </Button>
      </motion.div>
    </div>
  );
}

function OverallCard({ report }: { report: CheckupReport }) {
  return (
    <div className="card-highlighted relative overflow-hidden rounded-2xl border border-border-strong bg-surface/60 p-7 md:p-9">
      <div className="grid items-center gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Overall diagnosis
          </p>
          <h2 className="mt-2 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            {new URL(report.finalUrl).hostname}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {report.overallStatus === "healthy"
              ? "Your site is in good health overall — there are still some specific things to address below."
              : report.overallStatus === "needs-attention"
                ? "We found some symptoms worth treating — see the details below."
                : "Your site has serious symptoms. The details below explain what to fix first."}
          </p>
        </div>
        <div className="md:col-span-5 md:text-right">
          <CountUp target={report.overallScore} />
          <p className="mt-1 font-mono text-sm text-muted">
            Grade <span className="text-foreground">{report.overallGrade}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckCard({ check }: { check: CheckResult }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[check.id] ?? Activity;
  return (
    <div className="card-hover rounded-2xl border border-border bg-surface/40 p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight">
              {check.name}
            </h3>
            <p className="font-mono text-sm">
              <span
                className={cn(
                  "font-semibold",
                  STATUS_TONE[check.status]
                )}
              >
                {check.score}
              </span>
              <span className="text-muted"> · {check.grade}</span>
            </p>
          </div>
          <p className="mt-2 text-sm text-muted">{check.summary}</p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-strong transition-colors hover:text-foreground"
          >
            {check.findings.length} finding{check.findings.length === 1 ? "" : "s"}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                expanded && "rotate-180"
              )}
            />
          </button>

          <motion.div
            initial={false}
            animate={{
              height: expanded ? "auto" : 0,
              opacity: expanded ? 1 : 0,
            }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-4 space-y-3 border-t border-border/60 pt-4">
              {check.findings.map((f, i) => (
                <FindingRow key={i} finding={f} />
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const SEVERITY_ICON: Record<Severity, React.ComponentType<{ className?: string }>> = {
  info: CheckCircle2,
  low: Info,
  medium: AlertTriangle,
  high: AlertTriangle,
  critical: XCircle,
};

const SEVERITY_TONE: Record<Severity, string> = {
  info: "text-success",
  low: "text-muted",
  medium: "text-warning",
  high: "text-warning",
  critical: "text-signal",
};

function FindingRow({ finding }: { finding: Finding }) {
  const Icon = SEVERITY_ICON[finding.severity];
  return (
    <li className="flex items-start gap-3 text-sm">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", SEVERITY_TONE[finding.severity])} />
      <div>
        <p className="text-foreground">{finding.title}</p>
        {finding.detail && (
          <p className="mt-1 text-xs text-muted leading-relaxed">{finding.detail}</p>
        )}
      </div>
    </li>
  );
}

function CountUp({ target }: { target: number }) {
  const value = useMotionValue(0);
  const rounded = useTransform(value, (v) => Math.round(v));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(value, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [value, target]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = String(v);
    });
  }, [rounded]);

  return (
    <p className="font-mono text-6xl font-semibold leading-none tracking-tight md:text-7xl">
      <span ref={ref}>0</span>
      <span className="text-muted text-2xl ml-2 align-top mt-2 inline-block">/100</span>
    </p>
  );
}

type LeadResponse =
  | { ok: true; message: string; emailDelivered: boolean; emailError?: string }
  | { error: string; message: string };

function EmailGate({ report }: { report: CheckupReport }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    | { kind: "done"; emailDelivered: boolean; emailError?: string }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          url: report.finalUrl,
          source: "checkup",
          report,
        }),
      });
      const data = (await res.json()) as LeadResponse;
      if (!res.ok || "error" in data) {
        setError("message" in data ? data.message : "Couldn't send.");
        return;
      }
      setResult({
        kind: "done",
        emailDelivered: data.emailDelivered,
        emailError: data.emailError,
      });
    } catch {
      setError("Couldn't reach our service. Try again in a moment.");
    } finally {
      setPending(false);
    }
  }

  if (result?.kind === "done") {
    const trialHref = `/trial?email=${encodeURIComponent(email)}&url=${encodeURIComponent(report.finalUrl)}`;
    const headerBlock = result.emailDelivered ? (
      <div className="rounded-2xl border border-accent/30 bg-accent-soft p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Sent
        </p>
        <p className="mt-3 text-base text-foreground">
          Your full diagnostic report is on its way to{" "}
          <span className="font-mono">{email}</span>. Check your inbox in the
          next minute or two — also peek at spam, since this is our first
          time emailing you.
        </p>
      </div>
    ) : (
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-warning">
          Saved · email send delayed
        </p>
        <p className="mt-3 text-base text-foreground">
          We&apos;ve got your details. The automated report-email didn&apos;t
          go through this time
          {result.emailError ? ` (${result.emailError})` : ""}, so a doctor
          will follow up by hand from <span className="font-mono">hello@thecodedoctors.com</span> within
          one business day.
        </p>
      </div>
    );

    return (
      <div className="space-y-6">
        {headerBlock}

        {/* Convert path — every commitment-driven sign-up starts here. */}
        <div className="rounded-2xl border border-border-strong bg-surface/60 p-7 md:p-8">
          <div className="grid gap-6 md:grid-cols-12 md:items-center">
            <div className="md:col-span-7">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
                Want us to fix these?
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
                Start a free 7-day trial — we&apos;ll begin treatment today.
              </h3>
              <p className="mt-3 text-base text-muted">
                We pick the highest-impact findings above and ship the fixes
                this week. No card. Cancel anytime.
              </p>
            </div>
            <div className="md:col-span-5 flex flex-col gap-2 sm:flex-row md:flex-col md:items-stretch">
              <Button
                href={trialHref}
                size="md"
                variant="primary"
                className="w-full"
              >
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                href="/plans"
                size="md"
                variant="secondary"
                className="w-full"
              >
                See plans
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-strong bg-surface/60 p-7 md:p-8">
      <div className="grid items-center gap-6 md:grid-cols-12">
        <div className="md:col-span-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Want the full file?
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">
            Get the full report by email.
          </h3>
          <p className="mt-3 text-base text-muted">
            Every finding above, with prescriptions and the order to address
            them. Free. No spam.
          </p>
        </div>
        <form onSubmit={submit} className="md:col-span-6">
          <div className="rounded-xl border border-border-strong bg-background p-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex flex-1 items-center gap-3 rounded-lg bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
                <Mail className="h-4 w-4 shrink-0 text-accent" />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  placeholder="you@yourcompany.com"
                  aria-label="Email"
                  className="w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />
              </label>
              <Button
                type="submit"
                size="md"
                variant="primary"
                disabled={pending}
                className="shrink-0"
              >
                {pending ? "Sending…" : "Send report"}
                {!pending && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {error && (
            <p className="mt-2 text-xs text-signal">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
