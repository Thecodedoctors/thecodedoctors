import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { DiagnosticTool } from "@/components/diagnostic-tool";

export const metadata: Metadata = {
  title: "Free Checkup",
  description:
    "Enter your URL and we'll diagnose performance, SEO, security headers, mobile health, and broken links — in 60 seconds.",
};

export default function CheckupPage() {
  return (
    <Section size="lg">
      <div className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Free Checkup
        </p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          A 60-second diagnosis of any website.
        </h1>
        <p className="mt-6 text-lg text-muted">
          Enter your URL. We&apos;ll check transport, security headers, SEO,
          DNS posture, privacy & trackers, and performance — and email you the
          full report.
        </p>
      </div>

      <div className="mt-10 max-w-3xl">
        <DiagnosticTool />
      </div>
    </Section>
  );
}
