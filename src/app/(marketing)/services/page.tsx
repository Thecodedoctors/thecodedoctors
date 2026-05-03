import type { Metadata } from "next";
import { Treatments } from "@/components/treatments";
import { HowItWorks } from "@/components/how-it-works";
import { TrustStrip } from "@/components/trust-strip";
import { FinalCTA } from "@/components/final-cta";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Services",
    description: "Treatments for the whole site — security hardening, performance tuning, ongoing maintenance, full rebuilds.",
  },
  twitter: {
    title: "Services",
    description: "Treatments for the whole site — security hardening, performance tuning, ongoing maintenance, full rebuilds.",
  },
  title: "Services",
  description:
    "Performance, security, SEO, uptime, redesigns, and managed hosting — under one practice.",
};

export default function ServicesPage() {
  return (
    <>
      <Section size="lg" className="border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Services
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Every treatment your site needs, under one roof.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          We don&apos;t pick and choose. A healthy site needs all of these
          working together — and we deliver them under one monthly retainer.
        </p>
      </Section>
      <Treatments />
      <HowItWorks />
      <TrustStrip />
      <FinalCTA />
    </>
  );
}
