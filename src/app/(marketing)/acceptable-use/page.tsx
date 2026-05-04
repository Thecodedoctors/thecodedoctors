import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Acceptable Use Policy",
    description:
      "What kinds of sites and activity we will and won't host or maintain.",
  },
  twitter: {
    title: "Acceptable Use Policy",
    description:
      "What kinds of sites and activity we will and won't host or maintain.",
  },
  title: "Acceptable Use Policy",
  description:
    "Sites and activity we will and won't host or maintain at The Code Doctors.",
};

export default function AcceptableUsePage() {
  return (
    <Section size="lg">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Acceptable Use
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Acceptable Use Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-04</p>

        <div
          className="mt-10 space-y-6 text-muted leading-relaxed
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_strong]:text-foreground"
        >
          <p>
            We take pride in the businesses we work with and the sites we put
            our name on. This policy describes the kinds of sites and activity
            we will not maintain, develop, or host. It applies in addition to
            our <a href="/terms">Terms of Service</a>.
          </p>

          <h2>Sites we don&apos;t take on</h2>
          <p>
            We decline (or terminate) engagements involving:
          </p>
          <ul>
            <li>
              <strong>Illegal activity</strong> in the operator&apos;s or
              users&apos; jurisdiction — including unlicensed gambling, drug
              sales, weapon sales prohibited by applicable law, or services
              that exist primarily to enable a crime.
            </li>
            <li>
              <strong>Adult content</strong> without robust age-gating, or any
              sexual content involving minors (real or simulated). Zero
              tolerance.
            </li>
            <li>
              <strong>Scams, phishing, or impersonation</strong> — including
              fake support pages, copycat brand pages, fake reviews, lookalike
              checkout flows, and pages designed to harvest credentials.
            </li>
            <li>
              <strong>Predatory financial products</strong> — including
              binary-options &quot;trading&quot; mills, MLM recruitment
              funnels, payday loans operating in violation of local
              consumer-protection law, and pump-and-dump crypto schemes.
            </li>
            <li>
              <strong>Hate, harassment, or incitement</strong> targeting
              people or groups based on protected characteristics.
            </li>
            <li>
              <strong>Disinformation networks</strong> or coordinated
              inauthentic behavior, including AI-generated content presented
              as journalism without disclosure.
            </li>
            <li>
              <strong>IP infringement</strong> — sites whose primary value is
              redistributing copyrighted content without permission, brand
              counterfeiting, or trademark squatting.
            </li>
            <li>
              <strong>Malware distribution, command-and-control, or
              cryptojacking</strong>.
            </li>
            <li>
              <strong>Stalkerware or covert tracking</strong> — software that
              monitors a person without their knowing consent.
            </li>
          </ul>

          <h2>Things you must not do with our Services</h2>
          <ul>
            <li>
              Attempt to access another customer&apos;s account, data, or
              workspace.
            </li>
            <li>
              Attempt to circumvent authentication, rate limits, or other
              security controls on our platform.
            </li>
            <li>
              Probe or scan our infrastructure outside of an authorized
              security-research engagement (we welcome coordinated disclosure
              — see <a href="/security">/security</a>).
            </li>
            <li>
              Send unsolicited bulk email, spam, or any messaging that
              violates anti-spam law (CAN-SPAM, CASL, GDPR, etc.) using
              infrastructure we manage for you.
            </li>
            <li>
              Use Services to host content that violates a third party&apos;s
              privacy or intellectual-property rights.
            </li>
            <li>
              Resell, sublicense, or hold yourself out as us.
            </li>
            <li>
              Reverse-engineer our internal tools or attempt to extract our
              proprietary methodologies for the purpose of building a
              competitor.
            </li>
          </ul>

          <h2>Reporting abuse</h2>
          <p>
            If you believe a site we maintain is violating this policy, email{" "}
            <a href="mailto:security@thecodedoctors.com">
              security@thecodedoctors.com
            </a>{" "}
            with the URL and a short description of the issue. We investigate
            every report.
          </p>
          <p>
            Copyright takedown notices (DMCA-style) should include all
            information required by your jurisdiction&apos;s notice-and-action
            process. Send to{" "}
            <a href="mailto:hello@thecodedoctors.com">
              hello@thecodedoctors.com
            </a>{" "}
            with subject line &quot;Copyright Notice.&quot;
          </p>

          <h2>Enforcement</h2>
          <p>
            We&apos;ll usually contact you first to discuss a suspected
            violation and give you a reasonable opportunity to fix it. For
            severe violations (illegality, child safety, active malware,
            credible threats to others) we may suspend or terminate Services
            immediately and notify the relevant authorities.
          </p>
          <p>
            Termination for a material violation is not eligible for a refund
            of any unused, prepaid period.
          </p>
        </div>
      </article>
    </Section>
  );
}
