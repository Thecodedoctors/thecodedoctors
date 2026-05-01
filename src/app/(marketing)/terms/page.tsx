import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for The Code Doctors.",
};

export default function TermsPage() {
  return (
    <Section size="lg">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Terms
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-01</p>

        <div
          className="mt-10 space-y-6 text-muted leading-relaxed
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground"
        >
          <h2>The agreement</h2>
          <p>
            By using thecodedoctors.com or engaging us for services, you agree
            to these terms. If you don&apos;t agree, please don&apos;t use the
            site.
          </p>

          <h2>Services</h2>
          <p>
            We provide website rebuild, maintenance, security, and consulting
            services. The specific deliverables for any engagement are
            described in your treatment plan or proposal.
          </p>

          <h2>Payment</h2>
          <p>
            Monthly plans bill in advance. One-time engagements are quoted up
            front. All fees are in USD unless otherwise stated. Cancellation
            stops future billing immediately; no refunds for in-progress
            months.
          </p>

          <h2>Ownership</h2>
          <p>
            Code, designs, and content we produce for you are yours upon final
            payment. We retain the right to reference work in our portfolio
            unless you ask us not to.
          </p>

          <h2>Liability</h2>
          <p>
            We work carefully and back up everything. Still, our total
            liability for any claim is limited to the amount you paid us in the
            three months before the claim arose.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms occasionally. The &quot;last
            updated&quot; date is authoritative; material changes will also be
            announced by email if you&apos;re a customer.
          </p>
        </div>
      </article>
    </Section>
  );
}
