import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";

/**
 * Phase 1 placeholder. The live URL → audit tool ships in Phase 2.
 * Kept visually present so prospects immediately understand the offer.
 */
export function DiagnosticPreview() {
  return (
    <section
      aria-labelledby="diagnostic-heading"
      className="reveal relative border-b border-border/60 bg-surface/30"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-20 md:px-10 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
              Free · No signup
            </p>
            <h2
              id="diagnostic-heading"
              className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl"
            >
              Run a free checkup
              <br /> on any website.
            </h2>
            <p className="mt-4 max-w-md text-muted">
              Enter a URL and we&apos;ll diagnose performance, SEO, security
              headers, mobile health, and broken links — in 60 seconds.
            </p>
          </div>

          <div className="md:col-span-7">
            <Link
              href="/checkup"
              className="group relative block overflow-hidden rounded-2xl border border-border-strong bg-background p-1.5 transition-colors hover:border-accent"
            >
              <div className="flex flex-col gap-3 rounded-xl bg-surface/60 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 px-3 py-3">
                  <Activity className="h-4 w-4 shrink-0 text-accent" />
                  <span className="font-mono text-sm text-muted">
                    https://yourwebsite.com
                  </span>
                </div>
                <span className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-transform group-hover:translate-x-0">
                  Run Checkup
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <div className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60 bg-surface/40 px-2 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                <PreviewMetric label="Perf" />
                <PreviewMetric label="SEO" />
                <PreviewMetric label="A11y" />
                <PreviewMetric label="Security" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewMetric({ label }: { label: string }) {
  return (
    <div className="px-3 text-center">
      <span className="block text-foreground">— —</span>
      <span>{label}</span>
    </div>
  );
}
