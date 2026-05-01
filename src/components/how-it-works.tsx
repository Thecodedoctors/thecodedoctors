import { Section, SectionHeader } from "@/components/ui/section";

const steps = [
  {
    n: "01",
    title: "Diagnose",
    body: "We run a deep checkup on your site — performance, security, SEO, accessibility, content. You receive a 12-page report.",
  },
  {
    n: "02",
    title: "Prescribe",
    body: "We translate findings into a clear treatment plan with priorities, timelines, and expected outcomes.",
  },
  {
    n: "03",
    title: "Treat",
    body: "Our doctors execute the plan — surgery, security hardening, content fixes, redesigns. You approve before anything ships.",
  },
  {
    n: "04",
    title: "Maintain",
    body: "Monthly checkups keep your site healthy. We respond to symptoms before patients (your customers) ever notice.",
  },
];

export function HowItWorks() {
  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="The Method"
        title="How we work."
        description="Four steps. Always the same. No surprises."
      />
      <ol className="grid gap-px overflow-hidden rounded-2xl border border-border-strong bg-border-strong md:grid-cols-4">
        {steps.map((step) => (
          <li
            key={step.n}
            className="flex flex-col gap-4 bg-surface p-7 md:p-8"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              Step {step.n}
            </span>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
