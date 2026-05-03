"use client";

import { useState } from "react";
import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Three-tier plan ladder with a monthly/yearly billing toggle.
 *
 * Pricing strategy (locked in 2026-05-03):
 *   - The Checkup       — $599 one-time   (anchor: $899 after launch)
 *   - General Care      — $299/mo or $254/mo billed yearly ($3,049/yr, 15% off)
 *   - Premium Care      — $999/mo or $849/mo billed yearly ($10,189/yr, 15% off)
 *
 * Anchor framing is "Launch pricing — locked in for early patients" with the
 * future regular price shown crossed out. We do NOT show a fictitious "was"
 * price — the strikethrough is the *future* price, which is real and
 * legally defensible (FTC, EU Omnibus, UK CMA all prohibit fake markdowns).
 */

type Interval = "monthly" | "yearly";

const YEARLY_DISCOUNT = 0.15;

const PLANS = {
  checkup: {
    name: "The Checkup",
    sub: "One-time deep audit",
    blurb:
      "A 48-hour deep diagnosis. We tell you exactly what's wrong and what to fix — yours to keep, or hand to your team.",
    monthly: { price: 599, anchor: 899, cadence: "one-time" },
    yearly: { price: 599, anchor: 899, cadence: "one-time" },
    features: [
      "20+ page diagnostic report",
      "Performance, SEO, security, accessibility, mobile",
      "Up to 3 page-level mockups for the highest-priority fixes",
      "Delivered within 48 hours of purchase",
      "Money-back if the report underdelivers",
      "Credits toward your first 2 months of ongoing care",
    ],
    ctaLabel: "Book the Checkup",
    ctaHref: "/start?plan=checkup",
    highlighted: false as boolean,
  },
  general: {
    name: "General Care",
    sub: "Continuous improvements",
    blurb: "Steady upkeep + monthly improvements. We make your site better every month.",
    monthly: { price: 299, anchor: 449, cadence: "/ month" },
    yearly: {
      price: monthlyEquivalentYearly(299),
      anchor: 449,
      cadence: "/ month, billed yearly",
    },
    features: [
      "Monthly design + content improvements",
      "Monthly SEO work to grow search traffic",
      "Industry-standard security hardening",
      "Edits and fixes — whatever your site needs",
      "24/7 uptime monitoring + automatic backups",
      "Monthly report from your doctor",
    ],
    ctaLabel: "Start General Care",
    ctaHref: "/start?plan=general",
    highlighted: true as boolean,
  },
  premium: {
    name: "Premium Care",
    sub: "Active treatment",
    blurb:
      "Everything in General Care, with priority response, top-tier security, and proactive monitoring.",
    monthly: { price: 999, anchor: 1399, cadence: "/ month" },
    yearly: {
      price: monthlyEquivalentYearly(999),
      anchor: 1399,
      cadence: "/ month, billed yearly",
    },
    features: [
      "Everything in General Care, plus:",
      "Same-day priority response, 7 days a week",
      "Top-tier security hardening + mail authentication",
      "Email breach monitoring (HIBP) — alerts within the hour",
      "Live security + uptime telemetry on your dashboard",
      "Quarterly accessibility + security audit",
    ],
    ctaLabel: "Start Premium Care",
    ctaHref: "/start?plan=premium",
    highlighted: false as boolean,
  },
} as const;

/** $/mo display when paying yearly. The yearly discounted total divided
 *  by 12, rounded to the nearest dollar so the card reads cleanly. */
function monthlyEquivalentYearly(monthly: number): number {
  return Math.round((monthly * 12 * (1 - YEARLY_DISCOUNT)) / 12);
}

/** Total a customer pays today on the yearly plan — used for the
 *  small-print "$X,XXX/yr today" line. */
function yearlyTotal(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
}

export function PlansSection() {
  const [interval, setInterval] = useState<Interval>("monthly");

  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="Treatment Plans"
        title="Pick a plan. Cancel anytime."
        description="Launch pricing — locked in for our early patients. Goes up after launch."
      />

      <BillingToggle interval={interval} onChange={setInterval} />

      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {(["checkup", "general", "premium"] as const).map((key) => {
          const plan = PLANS[key];
          const cfg = interval === "yearly" ? plan.yearly : plan.monthly;
          const isOneTime = key === "checkup";
          const yearlyHint =
            !isOneTime && interval === "yearly"
              ? `$${yearlyTotal(plan.monthly.price).toLocaleString()}/yr today`
              : null;

          return (
            <li
              key={key}
              className={cn(
                "card-hover relative flex flex-col rounded-2xl border bg-surface/40 p-7 md:p-8",
                plan.highlighted
                  ? "card-highlighted border-accent/40 ring-1 ring-accent/30"
                  : "border-border"
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
                  Recommended
                </span>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {plan.name}
                </h3>
              </div>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {plan.sub}
              </p>
              <p className="mt-3 text-sm text-muted">{plan.blurb}</p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-mono text-5xl font-semibold tracking-tight text-foreground">
                  ${cfg.price.toLocaleString()}
                </span>
                <span className="text-sm text-muted">{cfg.cadence}</span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-xs">
                <span className="font-mono text-muted line-through decoration-muted/60">
                  ${cfg.anchor.toLocaleString()}
                </span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent ring-1 ring-inset ring-accent/30">
                  Launch pricing
                </span>
              </p>
              {yearlyHint && (
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {yearlyHint} · save 15%
                </p>
              )}

              <ul className="mt-7 flex-1 space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-muted-strong"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button
                  href={
                    isOneTime
                      ? plan.ctaHref
                      : `${plan.ctaHref}&interval=${interval}`
                  }
                  variant={plan.highlighted ? "primary" : "secondary"}
                  size="md"
                  className="w-full"
                >
                  {plan.ctaLabel}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-8 inline-flex items-center gap-2 text-xs text-muted">
        <Sparkles className="h-3 w-3 text-accent" />
        All monthly plans include uptime monitoring, automatic backups, and
        unlimited edits. No surprise hours, no contracts.
      </p>
    </Section>
  );
}

function BillingToggle({
  interval,
  onChange,
}: {
  interval: Interval;
  onChange: (i: Interval) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className="mt-6 inline-flex rounded-full border border-border bg-surface/40 p-1 text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={interval === "monthly"}
        onClick={() => onChange("monthly")}
        className={cn(
          "rounded-full px-4 py-1.5 font-mono uppercase tracking-[0.14em] transition-colors",
          interval === "monthly"
            ? "bg-accent text-background"
            : "text-muted hover:text-foreground"
        )}
      >
        Monthly
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={interval === "yearly"}
        onClick={() => onChange("yearly")}
        className={cn(
          "rounded-full px-4 py-1.5 font-mono uppercase tracking-[0.14em] transition-colors",
          interval === "yearly"
            ? "bg-accent text-background"
            : "text-muted hover:text-foreground"
        )}
      >
        Yearly
        <span className="ml-1.5 text-[9px] opacity-80">−15%</span>
      </button>
    </div>
  );
}
