import { Section } from "@/components/ui/section";

export function FounderNote() {
  return (
    <Section size="sm" className="border-b border-border/60">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          A note from the founder
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
          Hi, I&apos;m Precious. I started The Code Doctors because too many
          good businesses are losing customers to bad websites.
        </h2>
        <div className="mt-7 space-y-5 text-muted leading-relaxed">
          <p>
            You don&apos;t need to know what HSTS is or why your Lighthouse
            score matters. You shouldn&apos;t have to think about SSL renewals
            or whether the contact form works on Safari. That&apos;s our job.
          </p>
          <p>
            We&apos;re a small practice — five doctors, hand-picked. We answer
            our own messages. We send you reports you can read. And we keep our
            promises in writing, on our plans page.
          </p>
          <p className="text-muted-strong">
            If you&apos;d rather just see what&apos;s wrong with your site
            first — that&apos;s what the free checkup is for. No card, no
            commitment.
          </p>
        </div>
      </div>
    </Section>
  );
}
