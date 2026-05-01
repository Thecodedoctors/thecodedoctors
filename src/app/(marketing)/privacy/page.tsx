import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How we handle your data.",
};

export default function PrivacyPage() {
  return (
    <Section size="lg">
      <article className="prose prose-invert mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Privacy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-01</p>

        <Body>
          <h2>What we collect</h2>
          <p>
            We collect the information you give us when you fill out a form
            (name, email, website URL), and minimal usage data — page views and
            referrer — via our cookie-free analytics provider, Plausible.
          </p>

          <h2>What we don&apos;t do</h2>
          <p>
            We do not use Google Analytics, Facebook Pixel, advertising
            cookies, or any third-party tracker that fingerprints visitors. We
            do not sell your data. We do not share your information with
            advertising networks.
          </p>

          <h2>How we use it</h2>
          <p>
            Information you provide is used to respond to you, deliver our
            services, and (with your permission) follow up about how things are
            going. Analytics is used in aggregate to understand which pages
            help patients find us.
          </p>

          <h2>Where it lives</h2>
          <p>
            Customer data is stored on Postgres (Neon, US/EU regions),
            Cloudflare R2 (encrypted at rest), and Stripe (for billing).
            Backups are encrypted and retained for 30 days.
          </p>

          <h2>Your rights</h2>
          <p>
            You can request a copy of your data, ask us to correct it, or ask
            us to delete it at any time. Email{" "}
            <a href="mailto:privacy@thecodedoctors.com">privacy@thecodedoctors.com</a>{" "}
            and we&apos;ll respond within 30 days.
          </p>

          <h2>Cookies</h2>
          <p>
            We don&apos;t set tracking cookies. Essential cookies (e.g. session
            cookies in our portals) are documented in our{" "}
            <a href="/cookies">Cookies</a> page.
          </p>

          <h2>Changes</h2>
          <p>
            We&apos;ll update this page when our practice changes. The &quot;last
            updated&quot; date at the top is authoritative.
          </p>
        </Body>
      </article>
    </Section>
  );
}

function Body({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
      mt-10 space-y-6 text-muted leading-relaxed
      [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground
      [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border-strong [&_a]:underline-offset-4 hover:[&_a]:decoration-accent
      "
    >
      {children}
    </div>
  );
}
