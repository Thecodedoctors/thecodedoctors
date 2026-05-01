import { Section, SectionHeader } from "@/components/ui/section";
import {
  Activity,
  ShieldCheck,
  Search,
  Heart,
  Wand2,
  Server,
} from "lucide-react";

const treatments = [
  {
    icon: Activity,
    title: "Performance Surgery",
    body: "Cut load times in half. We hunt down every wasted byte and slow query.",
  },
  {
    icon: ShieldCheck,
    title: "Security Hardening",
    body: "HTTPS, HSTS, CSP, headers, DNS, dependencies, audit logs. We harden everything.",
  },
  {
    icon: Search,
    title: "SEO Recovery",
    body: "Schema, sitemaps, Core Web Vitals, content, internal links. Get found again.",
  },
  {
    icon: Heart,
    title: "Uptime Monitoring",
    body: "We watch your site 24/7. If it goes down, we know before your customers do.",
  },
  {
    icon: Wand2,
    title: "Redesigns & Rebuilds",
    body: "Tired, slow site? We rebuild on a modern stack — without losing your content or rankings.",
  },
  {
    icon: Server,
    title: "Managed Hosting",
    body: "Edge-cached, DDoS-protected, SSL-renewed, backed up nightly. You never think about it.",
  },
];

export function Treatments() {
  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="Our Treatments"
        title="One practice. Every treatment your site needs."
        description="We don't pick and choose. A healthy site needs all of these working together — and we deliver them under one monthly retainer."
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {treatments.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="card-hover group relative flex flex-col gap-4 rounded-2xl border border-border bg-surface/40 p-7"
          >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
