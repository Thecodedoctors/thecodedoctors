import type { Metadata } from "next";
import { FounderNote } from "@/components/founder-note";
import { TrustStrip } from "@/components/trust-strip";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "About",
  description:
    "A small practice of five doctors. We answer our own messages. We keep our promises in writing.",
};

const principles = [
  {
    title: "Plain language, always.",
    body: "If we can't explain it without jargon, we don't understand it well enough to ship it.",
  },
  {
    title: "Quality over volume.",
    body: "We work with a small number of patients well, not a large number of patients badly.",
  },
  {
    title: "Security first.",
    body: "Every site we touch leaves with stronger security than it had — no exceptions.",
  },
  {
    title: "Reports you can read.",
    body: "Monthly one-page summaries. No dashboards you'll never log into.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Section size="lg" className="border-b border-border/60">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          The Practice
        </p>
        <h1 className="mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Five doctors. One practice. No drama.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          We&apos;re a small team of senior engineers, designers, and security
          specialists. Every patient gets a lead doctor — a real person whose
          name you&apos;ll know.
        </p>
      </Section>

      <Section className="border-b border-border/60">
        <ul className="grid gap-px overflow-hidden rounded-2xl border border-border-strong bg-border-strong md:grid-cols-2">
          {principles.map((p) => (
            <li key={p.title} className="bg-surface p-8">
              <h3 className="text-lg font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {p.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <FounderNote />
      <TrustStrip />
    </>
  );
}
