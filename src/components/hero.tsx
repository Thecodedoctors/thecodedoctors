import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { HeroVideoBackdrop } from "@/components/hero-video-backdrop";

export function Hero() {
  return (
    <section
      aria-label="Introduction"
      className="relative overflow-hidden border-b border-border/60"
    >
      <HeroVideoBackdrop />
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

/* Hero backdrop is now <HeroVideoBackdrop/> (local preview): video,
 * then the dark contrast overlay, then the brand EKG line on top —
 * all behind the hero content. `git checkout src/components/hero.tsx`
 * (and delete hero-video-backdrop.tsx + public/hero-bg.mp4) restores
 * the original SVG-only backdrop. */
