import { Hero } from "@/components/hero";
import { DiagnosticPreview } from "@/components/diagnostic-preview";
import { ProblemStats } from "@/components/problem-stats";
import { Treatments } from "@/components/treatments";
import { HowItWorks } from "@/components/how-it-works";
import { PlansSection } from "@/components/plans-section";
import { PatientStories } from "@/components/patient-stories";
import { TrustStrip } from "@/components/trust-strip";
import { FounderNote } from "@/components/founder-note";
import { FAQ } from "@/components/faq";
import { FinalCTA } from "@/components/final-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <DiagnosticPreview />
      <ProblemStats />
      <Treatments />
      <HowItWorks />
      <PlansSection />
      <PatientStories />
      <TrustStrip />
      <FounderNote />
      <FAQ />
      <FinalCTA />
    </>
  );
}
