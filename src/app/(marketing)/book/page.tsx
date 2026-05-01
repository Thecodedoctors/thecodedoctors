import type { Metadata } from "next";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a Doctor",
  description:
    "Talk to one of our doctors. Free 30-minute call. No commitment.",
};

export default function BookPage() {
  return (
    <Section size="lg">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Book a Doctor
      </p>
      <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
        Talk to one of our doctors.
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        30 minutes. We&apos;ll listen, ask questions, and tell you straight
        whether we&apos;re a good fit. No commitment.
      </p>

      <div className="mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
        <Button
          href={`mailto:${site.email}?subject=Book%20a%20Doctor`}
          size="lg"
          variant="primary"
          className="w-full"
        >
          <Mail className="h-4 w-4" />
          Email us
        </Button>
        <Button href="/checkup" size="lg" variant="secondary" className="w-full">
          Run a free checkup first
        </Button>
      </div>

      <p className="mt-6 text-sm text-muted">
        Booking calendar opens in our next release. Until then, the fastest way
        to reach us is{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          {site.email}
        </a>
        .
      </p>
    </Section>
  );
}
