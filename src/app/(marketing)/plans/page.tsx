import type { Metadata } from "next";
import { PlansSection } from "@/components/plans-section";
import { FAQ } from "@/components/faq";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Treatment Plans",
    description:
      "Three ways to work with us — a one-time deep audit, or ongoing care from $299/mo. Today's rates through year-end.",
  },
  twitter: {
    title: "Treatment Plans",
    description:
      "Three ways to work with us — a one-time deep audit, or ongoing care from $299/mo. Today's rates through year-end.",
  },
  title: "Treatment Plans",
  description:
    "A one-time deep audit, or ongoing care. Flat fees, no surprise hours, cancel anytime.",
};

export default function PlansPage() {
  return (
    <>
      <Section size="lg" className="border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Treatment Plans
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Care for your site, on a flat fee.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          One-time audit or ongoing care — no surprise hours, no contracts.
          Today's rates apply through year-end; pricing adjusts upward in
          January 2027.
        </p>
      </Section>
      <PlansSection />
      <FAQ />
    </>
  );
}
