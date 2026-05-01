import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Section size="lg">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Diagnosis
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-7xl">
          404 — Page not found
        </h1>
        <p className="mt-6 text-lg text-muted">
          We checked the chart twice. This page isn&apos;t in our records.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Button href="/" size="md" variant="primary">
            Back to home
          </Button>
          <Button href="/checkup" size="md" variant="secondary">
            Run a free checkup
          </Button>
        </div>
      </div>
    </Section>
  );
}
