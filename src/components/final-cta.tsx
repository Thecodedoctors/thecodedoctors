import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section
      aria-label="Book a checkup"
      className="reveal relative overflow-hidden border-b border-border/60"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <div className="rounded-3xl border border-border-strong bg-surface/60 p-10 md:p-16">
          <div className="grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
                Book your free checkup.
                <br />
                <span className="text-muted">
                  We&apos;ll send a 12-page report within 24 hours.
                </span>
              </h2>
            </div>
            <div className="md:col-span-5 flex flex-col items-start gap-3 md:items-end">
              <Button href="/checkup" size="lg" variant="primary">
                Run Free Checkup
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button href="/book" size="lg" variant="secondary">
                Talk to a doctor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
