import { Section, SectionHeader } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

type Plan = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "The Checkup",
    price: "$199",
    cadence: "one-time",
    blurb: "A full diagnosis of your current site. Yours to keep.",
    features: [
      "12-page diagnostic report",
      "Performance, SEO, security, accessibility",
      "Prioritised prescription",
      "30-min review call with a doctor",
    ],
    ctaLabel: "Run a free Checkup",
    ctaHref: "/checkup",
  },
  {
    name: "General Care",
    price: "$129",
    cadence: "/ month",
    blurb: "Ongoing care for healthy sites. Stay fast, secure, online.",
    features: [
      "Managed hosting & SSL",
      "Daily backups",
      "Edits and fixes — whatever your site needs",
      "Uptime monitoring & alerts",
      "Monthly report from your doctor",
    ],
    ctaLabel: "Start General Care",
    ctaHref: "/start?plan=general",
  },
  {
    name: "Premium Care",
    price: "$349",
    cadence: "/ month",
    blurb:
      "Active treatment. We make your site better every month, on your behalf.",
    features: [
      "Everything in General Care",
      "Active improvements — we plan, you approve",
      "Performance & security hardening",
      "Monthly improvements roadmap",
      "Same-day emergency response",
      "Dedicated lead doctor",
    ],
    ctaLabel: "Start Premium Care",
    ctaHref: "/start?plan=premium",
    highlighted: true,
  },
];

export function PlansSection() {
  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="Treatment Plans"
        title="Pick a plan. Cancel anytime."
        description="Every plan is a flat fee. No surprise hours, no upsells. Want a custom plan? Talk to a doctor."
      />
      <ul className="grid gap-5 md:grid-cols-3">
        {plans.map((p) => (
          <li
            key={p.name}
            className={cn(
              "card-hover relative flex flex-col rounded-2xl border bg-surface/40 p-7 md:p-8",
              p.highlighted
                ? "card-highlighted border-accent/40 ring-1 ring-accent/30"
                : "border-border"
            )}
          >
            {p.highlighted && (
              <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
                Recommended
              </span>
            )}
            <div className="flex items-baseline gap-2">
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {p.name}
              </h3>
            </div>
            <p className="mt-3 text-sm text-muted">{p.blurb}</p>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="font-mono text-5xl font-semibold tracking-tight text-foreground">
                {p.price}
              </span>
              <span className="text-sm text-muted">{p.cadence}</span>
            </p>
            <ul className="mt-7 flex-1 space-y-3 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-muted-strong">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button
                href={p.ctaHref}
                variant={p.highlighted ? "primary" : "secondary"}
                size="md"
                className="w-full"
              >
                {p.ctaLabel}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
