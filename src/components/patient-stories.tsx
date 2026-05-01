import { Section, SectionHeader } from "@/components/ui/section";

const stories = [
  {
    patient: "Acme Coffee Co.",
    diagnosis: "Slow load times, missing security headers, broken checkout.",
    before: { perf: 41, sec: "C" },
    after: { perf: 99, sec: "A+" },
    outcome: "Page loads dropped from 6.2s to 0.9s. Conversions up 23% in 30 days.",
  },
  {
    patient: "Northwood Law Group",
    diagnosis: "Out-of-date CMS, no backups, low search visibility.",
    before: { perf: 56, sec: "F" },
    after: { perf: 100, sec: "A+" },
    outcome:
      "Migrated to a static stack. Organic traffic up 41% across 90 days.",
  },
  {
    patient: "Halsa Wellness",
    diagnosis: "Beautiful site, but failing accessibility and Core Web Vitals.",
    before: { perf: 62, sec: "B" },
    after: { perf: 100, sec: "A+" },
    outcome: "Now WCAG-AA compliant. Bounce rate down 18%.",
  },
];

export function PatientStories() {
  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="Patient Stories"
        title="Real sites. Real recoveries."
        description="No fluff testimonials — just before-and-after numbers."
      />
      <ul className="grid gap-5 md:grid-cols-3">
        {stories.map((s) => (
          <li
            key={s.patient}
            className="card-hover flex flex-col gap-5 rounded-2xl border border-border bg-surface/40 p-7"
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Patient
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                {s.patient}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-muted">{s.diagnosis}</p>

            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
              <BeforeAfter label="Performance" before={String(s.before.perf)} after={String(s.after.perf)} />
              <BeforeAfter label="Security" before={s.before.sec} after={s.after.sec} />
            </div>

            <p className="mt-auto text-sm font-medium text-muted-strong">
              {s.outcome}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BeforeAfter({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="bg-surface/60 px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-base text-muted line-through">
          {before}
        </span>
        <span className="font-mono text-2xl font-semibold text-foreground">
          {after}
        </span>
      </p>
    </div>
  );
}
