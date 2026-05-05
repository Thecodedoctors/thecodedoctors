import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Clock } from "lucide-react";
import { auth } from "@/auth";
import { OnboardForm } from "@/components/onboard-form";
import { Logo } from "@/components/logo";
import { ADMIN_HOME, APP_HOME } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Start care",
  description: "Sign up for ongoing care from The Code Doctors.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  plan?: string;
  interval?: string;
  email?: string;
  url?: string;
  ref?: string;
  canceled?: string;
}>;

const YEARLY_DISCOUNT = 0.15;

const PLANS = {
  checkup: {
    label: "The Checkup",
    sub: "One-time deep audit",
    monthly: { price: 599, anchor: 899, cadence: "one-time" },
    yearly: { price: 599, anchor: 899, cadence: "one-time" },
    description:
      "A 48-hour deep diagnosis of your site. 20+ page report covering performance, SEO, security, accessibility, mobile, and DNS posture, with a prioritized prescription. Up to 3 page-level mockups for the highest-priority improvements.",
    features: [
      "20+ page diagnostic report — yours to keep",
      "Performance, SEO, security, accessibility, mobile, DNS",
      "Up to 3 page-level mockups for top-priority fixes",
      "Competitor benchmark vs 3 sites of your choice",
      "Privacy + tracker audit (GDPR/CCPA posture)",
      "30-min strategy call after delivery",
      "Delivered within 48 hours of purchase",
      "Money-back if the report underdelivers",
      "$599 credit toward your first 2 months of ongoing care",
      "And more",
    ],
  },
  general: {
    label: "General Care",
    sub: "Continuous improvements",
    monthly: { price: 299, anchor: 449, cadence: "per month" },
    yearly: {
      price: monthlyEquivalent(299),
      anchor: 449,
      cadence: "per month, billed yearly",
    },
    description:
      "Steady upkeep + monthly improvements. We make your site better every month — design, SEO, security, edits — for a flat fee.",
    features: [
      "Monthly design + content improvements",
      "Monthly SEO work — keywords, schema, search-engine health",
      "Industry-standard security hardening + WAF",
      "Edits and fixes — whatever your site needs",
      "Plugin & dependency updates with rollback safety",
      "Form spam + bot protection",
      "Image + asset optimization for speed",
      "24/7 uptime monitoring + automatic backups",
      "Direct messaging with your doctor",
      "Monthly report from your doctor",
      "And more",
    ],
  },
  premium: {
    label: "Premium Care",
    sub: "Active treatment",
    monthly: { price: 899, anchor: 1399, cadence: "per month" },
    yearly: {
      price: monthlyEquivalent(899),
      anchor: 1399,
      cadence: "per month, billed yearly",
    },
    description:
      "Everything in General Care, with priority response, top-tier security, breach monitoring, and the option to commission custom work like mobile apps and integrations.",
    features: [
      "Everything in General Care, plus:",
      "Same-day priority response, 7 days a week + emergency line",
      "Top-tier security: WAF tuning, SPF/DKIM/DMARC, header lockdown",
      "Email breach monitoring (HIBP) — alerts within the hour",
      "Live security + uptime telemetry on your dashboard",
      "Quarterly accessibility + security audit",
      "A/B testing + monthly conversion experiments",
      "Staging environment + safe deploy workflow",
      "Quarterly strategy + roadmap session",
      "Custom builds — mobile apps, integrations, bespoke features (priced separately)",
      "And more",
    ],
  },
} as const;

function monthlyEquivalent(monthly: number): number {
  return Math.round((monthly * 12 * (1 - YEARLY_DISCOUNT)) / 12);
}

function yearlyTotal(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export default async function StartPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "client" ? APP_HOME : ADMIN_HOME);
  }

  const params = await searchParams;
  const planParam = params.plan;
  const plan = (
    planParam === "premium"
      ? "premium"
      : planParam === "checkup"
        ? "checkup"
        : "general"
  ) as "general" | "premium" | "checkup";
  const intervalRaw = params.interval === "yearly" ? "yearly" : "monthly";
  const interval = (plan === "checkup" ? "monthly" : intervalRaw) as
    | "monthly"
    | "yearly";

  const cfg = PLANS[plan];
  const priceCfg = interval === "yearly" ? cfg.yearly : cfg.monthly;
  const isOneTime = plan === "checkup";

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
      {/* Left — plan */}
      <div className="flex flex-col">
        <Link href="/" aria-label="The Code Doctors home" className="self-start">
          <Logo size={20} />
        </Link>

        <div className="mt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            {cfg.label}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {cfg.sub}
          </p>
          <h1 className="mt-3 flex items-baseline gap-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            ${priceCfg.price.toLocaleString()}
            <span className="text-base font-normal text-muted">
              {priceCfg.cadence}
            </span>
          </h1>
          <p className="mt-2 flex items-center gap-2 text-xs">
            <span className="font-mono text-muted line-through decoration-muted/60">
              ${priceCfg.anchor.toLocaleString()}
            </span>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent ring-1 ring-inset ring-accent/30">
              from 2027
            </span>
          </p>
          {!isOneTime && interval === "yearly" && (
            <p className="mt-2 font-mono text-[11px] text-muted">
              ${yearlyTotal(cfg.monthly.price).toLocaleString()}/yr charged today · save 15%
            </p>
          )}
          <p className="mt-5 max-w-md text-base text-muted">
            {cfg.description}
          </p>
        </div>

        <ul className="mt-10 space-y-3">
          {cfg.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 text-sm text-muted"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {!isOneTime && (
          <div className="mt-8 inline-flex rounded-full border border-border bg-surface/40 p-1 text-xs">
            <Link
              href={`/start?plan=${plan}&interval=monthly`}
              className={
                interval === "monthly"
                  ? "rounded-full bg-accent px-4 py-1.5 font-mono uppercase tracking-[0.14em] text-background"
                  : "rounded-full px-4 py-1.5 font-mono uppercase tracking-[0.14em] text-muted hover:text-foreground"
              }
            >
              Monthly
            </Link>
            <Link
              href={`/start?plan=${plan}&interval=yearly`}
              className={
                interval === "yearly"
                  ? "rounded-full bg-accent px-4 py-1.5 font-mono uppercase tracking-[0.14em] text-background"
                  : "rounded-full px-4 py-1.5 font-mono uppercase tracking-[0.14em] text-muted hover:text-foreground"
              }
            >
              Yearly
              <span className="ml-1.5 text-[9px] opacity-80">−15%</span>
            </Link>
          </div>
        )}

        {!isOneTime && (
          <Link
            href={`/start?plan=${plan === "general" ? "premium" : "general"}&interval=${interval}`}
            className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-border-strong px-4 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
          >
            Switch to{" "}
            {plan === "general" ? "Premium Care" : "General Care"}
          </Link>
        )}

        <p className="mt-12 inline-flex items-center gap-1.5 text-xs text-muted">
          {isOneTime ? (
            <>
              <Clock className="h-3 w-3" />
              Your report lands within 48 hours of purchase.
            </>
          ) : (
            <>
              <ShieldCheck className="h-3 w-3" />
              Cancel anytime from your dashboard. No hidden fees.
            </>
          )}
        </p>

        <p className="mt-3 text-xs text-muted">
          Already a patient?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Sign in
          </Link>
          {!isOneTime && (
            <>
              . Want to try it first?{" "}
              <Link
                href="/trial"
                className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
              >
                Free 7-day trial
              </Link>
            </>
          )}
          .
        </p>
      </div>

      {/* Right — form */}
      <div className="flex items-center">
        <div className="w-full max-w-md rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            {isOneTime ? "Book your Checkup" : "Start care"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            {isOneTime
              ? "Tell us where to look."
              : "Open your patient file."}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {isOneTime
              ? "We'll have a doctor on it the same day. Report lands in 48 hours."
              : "We'll have a doctor on it the same day."}
          </p>

          {params.canceled === "1" && (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              Checkout canceled. No charge — try again whenever you&apos;re ready.
            </p>
          )}

          <div className="mt-6">
            <OnboardForm
              variant={isOneTime ? "checkup" : "plan"}
              plan={plan === "checkup" ? undefined : plan}
              interval={interval}
              defaultEmail={params.email}
              defaultUrl={params.url}
              refCode={params.ref}
            />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            By {isOneTime ? "purchasing" : "signing up"}, you agree to our{" "}
            <Link
              href="/terms"
              className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              terms
            </Link>
            ,{" "}
            <Link
              href="/refund-policy"
              className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              refund policy
            </Link>
            , and{" "}
            <Link
              href="/privacy"
              className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
