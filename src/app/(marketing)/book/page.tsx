import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  openGraph: {
    title: "Contact us",
    description:
      "Tell us about your site. We'll be in touch within one business day.",
  },
  twitter: {
    title: "Contact us",
    description:
      "Tell us about your site. We'll be in touch within one business day.",
  },
  title: "Contact us",
  description:
    "Tell us about your site, what's working, and what isn't. We'll be in touch within one business day.",
};

export default function BookPage() {
  return (
    <Section size="lg">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — pitch */}
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Contact us
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Talk to one of our doctors.
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Tell us about your site — what&apos;s working, what isn&apos;t,
            what you&apos;re trying to fix. A doctor will reply within one
            business day. No commitment.
          </p>

          <div className="mt-10 max-w-md">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Want a 60-second auto-diagnosis first?
            </p>
            <Button
              href="/checkup"
              size="md"
              variant="secondary"
              className="mt-3"
            >
              Run a free Checkup
            </Button>
          </div>

          <p className="mt-10 text-xs text-muted">
            Prefer email? Reach us at{" "}
            <a
              href="mailto:hello@thecodedoctors.com"
              className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              hello@thecodedoctors.com
            </a>
            .
          </p>
        </div>

        {/* Right — form */}
        <div>
          <ContactForm />
        </div>
      </div>
    </Section>
  );
}
