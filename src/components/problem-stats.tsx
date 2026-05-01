import { Section, SectionHeader } from "@/components/ui/section";

const stats = [
  {
    figure: "53%",
    label: "of mobile users abandon a site that takes longer than 3 seconds to load.",
    source: "Google · Web Vitals",
  },
  {
    figure: "43%",
    label:
      "of cyberattacks target small businesses. 60% close within six months of a breach.",
    source: "Verizon DBIR",
  },
  {
    figure: "7%",
    label:
      "drop in conversions for every additional second of load time on the average site.",
    source: "Akamai",
  },
];

export function ProblemStats() {
  return (
    <Section size="md" className="border-b border-border/60">
      <SectionHeader
        eyebrow="The Symptoms"
        title="Most websites are quietly losing money."
        description="They look fine on the surface, but underneath, three things are going wrong on almost every site we examine."
      />
      <ul className="grid gap-px overflow-hidden rounded-2xl border border-border-strong bg-border-strong md:grid-cols-3">
        {stats.map((s) => (
          <li
            key={s.figure}
            className="flex flex-col justify-between gap-6 bg-surface p-8 md:p-10"
          >
            <p className="font-mono text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
              {s.figure}
            </p>
            <div>
              <p className="text-muted-strong leading-relaxed">{s.label}</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                {s.source}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
