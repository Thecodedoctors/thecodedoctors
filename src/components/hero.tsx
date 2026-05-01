import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden border-b border-border/60"
    >
      <EkgBackdrop />
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-28 md:px-10 md:pb-40 md:pt-40">
        <div className="max-w-3xl">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/60 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-strong">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Now accepting new patients
          </p>

          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-[88px]">
            Your website needs <br className="hidden sm:block" />a doctor.
          </h1>

          <p className="mt-7 max-w-xl text-balance text-lg leading-relaxed text-muted md:text-xl">
            We diagnose what&apos;s broken, prescribe the fix, and keep your site
            fast, secure, and online — for one flat monthly fee.
          </p>

          <div className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button href="/checkup" size="lg" variant="primary">
              Run Free Checkup
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button href="/plans" size="lg" variant="secondary">
              See Treatment Plans
            </Button>
          </div>

          <p className="mt-8 inline-flex items-center gap-2 text-sm text-muted">
            <ShieldCheck className="h-4 w-4 text-accent" />
            No card. No spam. A 12-page report within 24 hours.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Ambient EKG line drawn as inline SVG.
 * Pure CSS animation — keeps Lighthouse 100 on the marketing site.
 * Replaced with WebGL version in Phase 7.
 */
function EkgBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0 select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-border-strong to-transparent opacity-60" />
      <svg
        className="absolute inset-x-0 top-1/2 mx-auto h-44 w-full max-w-6xl -translate-y-1/2 opacity-90"
        viewBox="0 0 1200 200"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ekg-fade" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="0.15" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="0.85" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="ekg-line"
          d="M0 100 L200 100 L260 100 L280 60 L300 140 L320 80 L340 100 L600 100 L660 100 L680 30 L700 170 L720 70 L740 100 L1000 100 L1200 100"
          stroke="url(#ekg-fade)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-x-0 -top-32 mx-auto h-96 max-w-4xl rounded-full bg-accent/10 blur-3xl" />
    </div>
  );
}
