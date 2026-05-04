import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Refund Policy",
    description:
      "How refunds work for the Checkup, monthly plans, and yearly plans at The Code Doctors.",
  },
  twitter: {
    title: "Refund Policy",
    description:
      "How refunds work for the Checkup, monthly plans, and yearly plans at The Code Doctors.",
  },
  title: "Refund Policy",
  description:
    "How refunds work for the Checkup, monthly plans, and yearly plans at The Code Doctors.",
};

export default function RefundPolicyPage() {
  return (
    <Section size="lg">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Refunds
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Refund Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-04</p>

        <div
          className="mt-10 space-y-6 text-muted leading-relaxed
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_strong]:text-foreground"
        >
          <h2>The Checkup — money-back guarantee</h2>
          <p>
            We&apos;re confident in the Checkup. If, within{" "}
            <strong>14 days of delivery</strong>, the report{" "}
            <strong>materially fails</strong> to deliver what we promised on
            the purchase page, we&apos;ll refund the full purchase price.
          </p>
          <p>
            For the avoidance of doubt, the money-back guarantee applies to:
          </p>
          <ul>
            <li>
              The completeness of the diagnostic report (we delivered fewer
              than the advertised number of pages or skipped advertised
              categories: performance, SEO, security, accessibility, mobile,
              DNS posture).
            </li>
            <li>
              Late delivery (the report wasn&apos;t delivered within 48 hours
              of purchase, where the delay is our fault and not caused by
              your site being unreachable or our needing additional access
              from you).
            </li>
            <li>
              Inaccuracy that any reasonable practitioner would consider a
              material error.
            </li>
          </ul>
          <p>
            The money-back guarantee does <strong>not</strong> apply to:
          </p>
          <ul>
            <li>
              Subjective taste disagreements about the proposed mockups (we
              welcome feedback and will revise within reason; refund is not
              the channel for that).
            </li>
            <li>
              Findings you disagree with on a question of professional
              judgment (we&apos;re happy to walk you through the evidence —
              that&apos;s included in the price).
            </li>
            <li>
              Delays caused by your site being unreachable, password gates we
              don&apos;t have access to, or your needing more time to provide
              required information.
            </li>
            <li>
              Refund requests made more than 14 days after the report was
              delivered.
            </li>
          </ul>
          <p>
            To request a Checkup refund, email{" "}
            <a href="mailto:hello@thecodedoctors.com">
              hello@thecodedoctors.com
            </a>{" "}
            within 14 days of delivery, citing the specific shortfall.
            We&apos;ll review and respond within 5 business days. Approved
            refunds are processed via Stripe to the original payment method
            within 5–10 business days of approval.
          </p>

          <h2>Checkup credit toward ongoing care</h2>
          <p>
            If you start a recurring plan (General Care or Premium Care)
            within <strong>30 days</strong> of your Checkup purchase, we apply
            the $599 Checkup payment as a credit toward your first 2 months of
            ongoing care. The credit is single-use, non-transferable, and
            non-refundable as cash. If the credited months are longer than the
            credit, we charge the difference; we don&apos;t carry surplus
            credit forward.
          </p>

          <h2>Recurring plans — monthly</h2>
          <p>
            Monthly plans (General Care, Premium Care) are billed in advance.
            You can cancel at any time from the billing page or the Stripe
            portal; cancellation takes effect at the end of the current
            billing period and you keep access until then.
          </p>
          <p>
            <strong>We don&apos;t prorate refunds for the current month.</strong>{" "}
            If exceptional circumstances apply (extended outage on our side,
            severe billing error, applicable consumer-protection law),
            email us and we&apos;ll review case-by-case.
          </p>

          <h2>Recurring plans — yearly</h2>
          <p>
            Yearly plans charge the discounted annual amount (15% off the
            monthly equivalent) at signup and at each renewal. You can cancel
            renewal at any time from the Stripe portal; cancellation prevents
            the next year from being charged but does not refund the current
            year.
          </p>
          <p>
            Within the <strong>first 14 days</strong> of a new yearly term, if
            you decide the plan isn&apos;t working out, email us for a
            pro-rated refund of the unused remainder of the year (we keep an
            amount equal to a single month at the monthly price for the work
            already in flight). After 14 days, refunds are not available
            mid-term.
          </p>

          <h2>Failed payments</h2>
          <p>
            If a renewal payment fails, we retry per Stripe&apos;s default
            schedule and notify you. If the payment isn&apos;t cured within 7
            days, Services may be suspended; full termination follows another
            14 days of non-payment. No refund is owed for periods during which
            access was active but unpaid.
          </p>

          <h2>Chargebacks and disputes</h2>
          <p>
            If you have a billing concern, please contact us first — we
            respond fast and resolve almost everything informally. Filing a
            chargeback before contacting us may result in suspension of
            Services pending resolution.
          </p>

          <h2>Goodwill</h2>
          <p>
            This policy sets the floor, not the ceiling. If you&apos;re
            unhappy and we feel a refund or credit is the right call,
            we&apos;ll do it even if it&apos;s outside what&apos;s strictly
            required here. Reach out — we&apos;re reasonable people.
          </p>

          <h2>Contact</h2>
          <p>
            Refund and billing questions:{" "}
            <a href="mailto:hello@thecodedoctors.com">
              hello@thecodedoctors.com
            </a>
            .
          </p>
        </div>
      </article>
    </Section>
  );
}
