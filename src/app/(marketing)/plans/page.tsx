import type { Metadata } from "next";
import { PlansSection } from "@/components/plans-section";
import { FAQ } from "@/components/faq";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Treatment Plans",
  description:
    "Flat monthly fees. No surprise hours, no upsells. Cancel anytime.",
};

export default function PlansPage() {
  return (
    <>
      <Section size="lg" className="border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Treatment Plans
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Care for your site, on a flat monthly fee.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          No surprise hours, no upsells, no contracts. Pick the level of care
          that fits, and change your mind anytime.
        </p>
      </Section>
      <PlansSection />
      <FAQ />
    </>
  );
}
