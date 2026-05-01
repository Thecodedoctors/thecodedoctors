import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section } from "@/components/ui/section";
import { RequestForm } from "@/components/request-form";

export const metadata: Metadata = {
  title: "New request",
  robots: { index: false, follow: false },
};

export default function NewRequestPage() {
  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-accent">
          New request
        </p>
        <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          What&apos;s wrong with your site?
        </h1>
        <p className="mt-3 text-base text-muted">
          Describe the symptom in plain language. A doctor will triage within
          one business day and reply on this request.
        </p>

        <div className="mt-10">
          <RequestForm />
        </div>
      </div>
    </Section>
  );
}
