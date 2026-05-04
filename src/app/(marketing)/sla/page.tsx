import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  openGraph: {
    title: "Service Levels",
    description:
      "Our response and uptime targets — best-effort goals, not contractual guarantees.",
  },
  twitter: {
    title: "Service Levels",
    description:
      "Our response and uptime targets — best-effort goals, not contractual guarantees.",
  },
  title: "Service Levels",
  description:
    "Our response and uptime targets across the Checkup, General Care, and Premium Care.",
};

export default function SlaPage() {
  return (
    <Section size="lg">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Service Levels
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Service Levels
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-04</p>

        <div
          className="mt-10 space-y-6 text-muted leading-relaxed
          [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground
          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1
          [&_strong]:text-foreground
          [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse
          [&_th]:text-left [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:text-foreground
          [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td]:border-t [&_td]:border-border/40"
        >
          <p>
            We publish the targets below so you know what to expect and so we
            have something to hold ourselves accountable to. These are{" "}
            <strong>best-effort goals, not contractual guarantees</strong>.
            We do not offer service credits for missed targets — instead, if a
            miss is causing you real harm, talk to us and we will make it
            right on a case-by-case basis.
          </p>
          <p>
            See our <a href="/terms">Terms of Service</a> and{" "}
            <a href="/refund-policy">Refund Policy</a> for the legally binding
            commitments.
          </p>

          <h2>Response targets</h2>
          <p>
            &quot;Response&quot; means an acknowledgement from a doctor that
            we&apos;ve seen the request and are working on it — not the time
            to fully resolve.
          </p>
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Business hours</th>
                <th>After-hours / weekends</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>The Checkup</td>
                <td>Within 24 hours of purchase</td>
                <td>Within 24 hours of purchase</td>
              </tr>
              <tr>
                <td>General Care</td>
                <td>Within 1 business day</td>
                <td>Best-effort, next business day</td>
              </tr>
              <tr>
                <td>Premium Care</td>
                <td>Same day, 7 days a week</td>
                <td>
                  Emergency line (down/critical) acknowledged within 4 hours
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3">
            <strong>Business hours</strong> are 9am–6pm in the time zone of the
            doctor assigned to your account, Monday through Friday, excluding
            local public holidays.
          </p>

          <h2>What &quot;emergency&quot; means on Premium Care</h2>
          <p>
            The after-hours emergency line is for issues that materially
            affect your visitors or revenue, such as:
          </p>
          <ul>
            <li>The site is fully down or returning errors to most visitors.</li>
            <li>Checkout, signup, or contact forms are broken.</li>
            <li>An active security incident is in progress.</li>
            <li>The site is actively serving malware or phishing content.</li>
          </ul>
          <p>
            It&apos;s not for new feature requests, design changes, or
            non-urgent edits — those go through the normal request flow and
            get the same-day response target during business hours.
          </p>

          <h2>Uptime monitoring</h2>
          <p>
            We monitor every site we maintain on a 1-minute interval from at
            least three geographic regions, with alerts to the on-call doctor.
            We aim for 99.9% application uptime measured at the edge.
          </p>
          <p>
            Uptime depends on hosting providers, DNS, third-party APIs, and
            your own configuration changes. We don&apos;t guarantee specific
            uptime numbers as a contractual commitment.
          </p>

          <h2>Backups</h2>
          <p>
            Recurring plans include automatic backups of files and database
            taken before any change we make and on a regular cadence we
            configure for your stack. Backups are retained for at least 30
            days. Restore is best-effort and depends on the integrity of the
            most recent backup; backups are mitigations, not a guarantee
            against data loss.
          </p>

          <h2>Maintenance windows</h2>
          <p>
            We schedule risky changes (major version upgrades, large
            migrations) outside your business hours where practical, and
            announce them in advance via the dashboard and email.
          </p>

          <h2>Status page</h2>
          <p>
            Operational status and any active incidents are published at{" "}
            <a href="/status">/status</a>.
          </p>

          <h2>Scope of these targets</h2>
          <p>The targets above don&apos;t apply when:</p>
          <ul>
            <li>
              The issue is caused by a third-party provider (hosting, DNS,
              registrar, payment processor, CDN) outside our control.
            </li>
            <li>
              The issue is caused by changes you or another vendor made
              outside our coordination.
            </li>
            <li>
              Your account is past-due on payment.
            </li>
            <li>
              We&apos;re prevented from acting by a government order, legal
              requirement, or platform restriction.
            </li>
            <li>
              A force-majeure event applies (see the Force Majeure section of
              our Terms).
            </li>
          </ul>
        </div>
      </article>
    </Section>
  );
}
