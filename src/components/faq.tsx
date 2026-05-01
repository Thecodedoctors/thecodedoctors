import { Section, SectionHeader } from "@/components/ui/section";

const faqs = [
  {
    q: "Do I have to switch hosts to work with you?",
    a: "No. We work on your existing host. If you'd like us to manage hosting (it's usually faster and more secure), we can migrate you cleanly with zero downtime.",
  },
  {
    q: "What if my site is on WordPress / Shopify / Squarespace / custom code?",
    a: "We work on all of them. Most of our patients are on WordPress, Shopify, or a custom stack. If we can't help, we'll tell you up front.",
  },
  {
    q: "How long until I see results?",
    a: "Most performance gains and security fixes ship in the first 7–14 days of treatment. SEO recovery typically shows in 30–90 days.",
  },
  {
    q: "Can I cancel?",
    a: "Yes — anytime, no questions. We keep clients because they want to stay, not because they're stuck.",
  },
  {
    q: "Are my files and access safe?",
    a: "We hold credentials in a hardened password manager with role-based access. Every staff action is logged in an immutable audit trail. We can sign an NDA on request.",
  },
  {
    q: "What if my site goes down at 2am?",
    a: "Premium Care includes same-day emergency response, including overnight. We watch uptime 24/7 and we'll usually know before you do.",
  },
];

export function FAQ() {
  return (
    <Section className="border-b border-border/60">
      <SectionHeader
        eyebrow="Common Questions"
        title="Things patients ask before booking."
      />
      <div className="grid gap-px overflow-hidden rounded-2xl border border-border-strong bg-border-strong md:grid-cols-2">
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group bg-surface p-7 transition-colors open:bg-surface-2"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-medium text-foreground">
              {f.q}
              <span
                aria-hidden
                className="mt-1 font-mono text-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
