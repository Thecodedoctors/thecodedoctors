import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Terms of Service",
    description:
      "Plain-English terms for using The Code Doctors and our services.",
  },
  twitter: {
    title: "Terms of Service",
    description:
      "Plain-English terms for using The Code Doctors and our services.",
  },
  title: "Terms of Service",
  description:
    "The terms governing your use of The Code Doctors and the services we provide.",
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
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-04</p>

        <div
          className="mt-10 space-y-6 text-muted leading-relaxed
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_strong]:text-foreground"
        >
          <h2>1. Who we are</h2>
          <p>
            The Code Doctors is operated by Angel Tech Solutions
            (&quot;we&quot;, &quot;us&quot;, &quot;The Code Doctors&quot;).
            These Terms govern your use of <strong>thecodedoctors.com</strong>{" "}
            (the &quot;Site&quot;), our patient and admin portals, and any
            services we provide to you under a treatment plan, the Checkup
            product, or a custom engagement (collectively, the
            &quot;Services&quot;).
          </p>
          <p>
            By creating an account, paying for a plan, or otherwise using the
            Services, you agree to these Terms, our{" "}
            <a href="/privacy">Privacy Policy</a>, our{" "}
            <a href="/refund-policy">Refund Policy</a>, our{" "}
            <a href="/acceptable-use">Acceptable Use Policy</a>, and our{" "}
            <a href="/sla">Service Levels</a>. If you don&apos;t agree, don&apos;t
            use the Services.
          </p>

          <h2>2. The Services</h2>
          <p>
            We provide website maintenance, security, performance, design, SEO,
            and consulting services. The specific deliverables for any
            engagement are described in the plan you purchase, the Checkup
            scope, or a written proposal we agree on with you.
          </p>
          <p>
            Our recurring plans (General Care, Premium Care) are billed in
            advance on a monthly or yearly cadence. The Checkup is a one-time
            paid product delivered within 48 hours of purchase. We may modify
            the contents of a plan from time to time; material changes affecting
            existing customers will be announced by email at least 30 days
            before they take effect.
          </p>

          <h2>3. Your account</h2>
          <p>
            You&apos;re responsible for keeping your login credentials
            confidential, for the activity that occurs under your account, and
            for keeping the contact and billing information on your account
            accurate. If you suspect an unauthorized access, contact us
            immediately at{" "}
            <a href="mailto:security@thecodedoctors.com">
              security@thecodedoctors.com
            </a>
            .
          </p>
          <p>
            Accounts are for a single business or organization. You may invite
            additional team members under your account; you remain responsible
            for their use of the Services.
          </p>

          <h2>4. Your content and our access</h2>
          <p>
            You may give us access to your website, hosting accounts, domain
            registrar, content management system, third-party tools, and other
            systems necessary to perform the Services. You represent and
            warrant that you have the authority to grant that access and that
            doing so doesn&apos;t violate any agreement you have with a third
            party.
          </p>
          <p>
            We may store credentials you provide using strong encryption (see
            our{" "}
            <a href="/security">Security page</a>) for the duration of our
            engagement and a short retention period afterward, and we&apos;ll
            delete them on request.
          </p>
          <p>
            You retain all rights in the websites, content, designs, and data
            you give us. You grant us a non-exclusive license to use, copy, and
            modify your content solely as needed to perform the Services. Code,
            designs, and content we create specifically for you under a paid
            engagement are yours upon final payment, except for any third-party
            components, our pre-existing tools, or general know-how, which we
            retain.
          </p>

          <h2>5. Payment and billing</h2>
          <h3>Recurring plans</h3>
          <ul>
            <li>
              Plans are charged in advance. Monthly plans renew every 30 days;
              yearly plans renew every 12 months at the then-current price for
              that plan.
            </li>
            <li>
              You can cancel renewal at any time from the billing page or the
              Stripe portal. Cancellation takes effect at the end of the
              current billing period. We don&apos;t prorate refunds for the
              current period.
            </li>
            <li>
              We may suspend Services if a payment fails and isn&apos;t cured
              within 7 days. Final termination follows another 14 days of
              non-payment.
            </li>
          </ul>
          <h3>The Checkup (one-time)</h3>
          <ul>
            <li>
              The Checkup is charged in full at purchase. It includes a written
              report and up to three page-level mockups, delivered within 48
              hours of purchase.
            </li>
            <li>
              Subject to our{" "}
              <a href="/refund-policy">Refund Policy</a>, the Checkup is
              eligible for a full refund within 14 days if the report
              materially fails to deliver what we promised.
            </li>
          </ul>
          <h3>Promotions and credits</h3>
          <p>
            From time to time we may offer launch pricing, discounts, referral
            credits, or apply Checkup payments toward your first months of
            ongoing care. Promotional pricing is honored for the duration we
            promise; renewal at the same rate is not guaranteed beyond that
            term.
          </p>
          <h3>Taxes</h3>
          <p>
            Fees are exclusive of any sales, use, VAT, GST, or similar taxes.
            Where required, we&apos;ll add applicable taxes to your invoice.
          </p>

          <h2>6. Acceptable use</h2>
          <p>
            You agree to abide by our{" "}
            <a href="/acceptable-use">Acceptable Use Policy</a>. We may decline
            or terminate Services for any site or activity that materially
            violates that policy, applicable law, or the rights of others. We
            will give reasonable notice and a refund of any unused, prepaid
            period when termination is initiated by us for reasons other than a
            material breach of these Terms or the Acceptable Use Policy by you.
          </p>

          <h2>7. Service levels and uptime</h2>
          <p>
            We work hard to keep your site online and to respond promptly. The
            response targets we publish on our{" "}
            <a href="/sla">Service Levels page</a> are best-effort goals, not
            contractual guarantees. We do not offer service credits for missed
            response times. If a missed target is causing you real harm, talk
            to us and we&apos;ll make it right.
          </p>
          <p>
            Uptime, search ranking, conversion rate, and revenue depend on many
            factors outside our control (your hosting, third-party providers,
            search-engine algorithms, your business decisions). We don&apos;t
            guarantee specific outcomes for any of these metrics.
          </p>

          <h2>8. Confidentiality</h2>
          <p>
            We&apos;ll treat any non-public information you give us as
            confidential and use it only to provide the Services. We may
            disclose confidential information when required by law, to enforce
            these Terms, or with your consent. You agree to treat any
            non-public information about our methods, prices, or systems with
            the same care.
          </p>

          <h2>9. Your representations and warranties</h2>
          <p>You represent and warrant that:</p>
          <ul>
            <li>
              You have the legal authority to enter these Terms and to engage
              us for the Services.
            </li>
            <li>
              You own or are licensed to use all content, code, designs, and
              data you provide, and our use of those materials as contemplated
              here will not infringe any third party&apos;s rights.
            </li>
            <li>
              Your use of the Services and your website complies with
              applicable laws (including data-protection, consumer-protection,
              and intellectual-property laws).
            </li>
          </ul>

          <h2>10. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless The Code Doctors,
            Angel Tech Solutions, and our officers, employees, and contractors
            from any third-party claim, demand, loss, liability, damage, or
            expense (including reasonable legal fees) arising out of or related
            to: (a) your content; (b) your use of the Services in violation of
            these Terms or applicable law; (c) your breach of any
            representation or warranty; or (d) any system, account, or
            credential you authorized us to use.
          </p>
          <p>
            We&apos;ll notify you of any claim subject to this section, let you
            control the defense (with counsel reasonably acceptable to us), and
            cooperate at your expense. You won&apos;t settle any claim that
            imposes obligations on us without our prior written consent.
          </p>

          <h2>11. Disclaimers</h2>
          <p>
            <strong>
              The Services are provided &quot;as is&quot; and &quot;as
              available.&quot;
            </strong>{" "}
            To the maximum extent permitted by law, we disclaim all warranties,
            whether express, implied, statutory, or otherwise, including any
            implied warranties of merchantability, fitness for a particular
            purpose, non-infringement, accuracy, or quiet enjoyment.
          </p>
          <p>
            We don&apos;t warrant that the Services will be uninterrupted,
            error-free, free of harmful components, or that defects will be
            corrected. Backups, monitoring, and security tools are mitigations,
            not guarantees against data loss, downtime, or attack.
          </p>

          <h2>12. Limitation of liability</h2>
          <p>
            <strong>
              To the maximum extent permitted by law, our total liability for
              any claim arising out of or related to these Terms or the
              Services is limited to the amount you paid us in the twelve (12)
              months preceding the event giving rise to the claim.
            </strong>
          </p>
          <p>
            <strong>
              Neither party is liable for indirect, incidental, special,
              consequential, exemplary, or punitive damages, or for lost
              profits, lost revenue, lost business opportunity, lost goodwill,
              or loss of data, even if advised of the possibility of those
              damages.
            </strong>
          </p>
          <p>
            These limitations apply regardless of the theory of liability
            (contract, tort, strict liability, or otherwise) and survive any
            termination of these Terms.
          </p>

          <h2>13. Term and termination</h2>
          <p>
            These Terms apply for as long as you use the Services. Either party
            may terminate at any time by providing notice; cancellation of a
            recurring plan can be done from the billing page or the Stripe
            portal.
          </p>
          <p>
            We may suspend or terminate your access immediately for non-payment,
            a material breach of these Terms or the Acceptable Use Policy, or
            if we&apos;re required to do so by law or by a service provider we
            depend on.
          </p>
          <p>
            On termination, sections that by their nature should survive
            (payment for amounts owed, ownership, confidentiality, indemnity,
            disclaimers, limitation of liability, dispute resolution) will
            survive.
          </p>

          <h2>14. Force majeure</h2>
          <p>
            Neither party is liable for any delay or failure to perform caused
            by events beyond reasonable control, including outages of
            third-party providers (hosting, registrars, payment processors),
            internet failures, natural disasters, war, terrorism, civil unrest,
            labor disputes, government action, or pandemic.
          </p>

          <h2>15. Dispute resolution</h2>
          <p>
            We aim to resolve every dispute by good-faith conversation first.
            Email{" "}
            <a href="mailto:hello@thecodedoctors.com">
              hello@thecodedoctors.com
            </a>{" "}
            with the issue and we&apos;ll respond within five business days.
            Most things get sorted out from there. Nothing in these Terms
            limits any rights you have under mandatory consumer-protection
            law where you live.
          </p>

          <h2>16. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. The &quot;Last
            updated&quot; date at the top is authoritative. Material changes
            will be announced by email if you&apos;re an active customer at
            least 30 days before they take effect. Continued use of the
            Services after the effective date constitutes acceptance.
          </p>

          <h2>17. Miscellaneous</h2>
          <ul>
            <li>
              <strong>Entire agreement:</strong> these Terms (along with the
              Privacy Policy, Refund Policy, Acceptable Use Policy, and any
              proposal or order form we sign) are the entire agreement between
              us, and supersede any prior agreements.
            </li>
            <li>
              <strong>Severability:</strong> if any provision is unenforceable,
              the rest remain in effect.
            </li>
            <li>
              <strong>No waiver:</strong> failure to enforce a right is not a
              waiver of that right.
            </li>
            <li>
              <strong>Assignment:</strong> you may not assign these Terms
              without our written consent. We may assign them in connection
              with a merger, acquisition, or sale of our business.
            </li>
            <li>
              <strong>Contact:</strong> questions go to{" "}
              <a href="mailto:hello@thecodedoctors.com">
                hello@thecodedoctors.com
              </a>
              .
            </li>
          </ul>
        </div>
      </article>
    </Section>
  );
}
