import type { Metadata } from "next";
import { PatientStories } from "@/components/patient-stories";
import { FinalCTA } from "@/components/final-cta";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Patient Stories",
  description:
    "Real sites, real recoveries. Before-and-after numbers from our practice.",
};

export default function StoriesPage() {
  return (
    <>
      <Section size="lg" className="border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Patient Stories
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Real sites. Real recoveries.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          We don&apos;t do testimonial fluff. Every story below has the
          before-and-after numbers — performance, security grade, business
          impact.
        </p>
      </Section>
      <PatientStories />
      <FinalCTA />
    </>
  );
}
