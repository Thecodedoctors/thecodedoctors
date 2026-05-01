import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Cookies",
  description: "What cookies we set, why, and how to control them.",
};

export default function CookiesPage() {
  return (
    <Section size="lg">
      <article className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Legal · Cookies
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          Cookies
        </h1>
        <p className="mt-3 text-sm text-muted">Last updated: 2026-05-01</p>

        <div className="mt-10 space-y-6 text-muted leading-relaxed">
          <p>
            We don&apos;t use tracking cookies on the public marketing site.
            Analytics is provided by Plausible, which is cookie-free.
          </p>
          <p>
            When you sign into the client portal (
            <code className="font-mono text-foreground">app.thecodedoctors.com</code>) or
            the staff portal (
            <code className="font-mono text-foreground">admin.thecodedoctors.com</code>),
            we set a single essential session cookie. It&apos;s
            HttpOnly, Secure, SameSite=Lax, and signed. It is not used for
            tracking, advertising, or any third-party purpose.
          </p>
          <p>
            You can clear cookies at any time via your browser settings.
            Clearing the session cookie will sign you out of our portals.
          </p>
        </div>
      </article>
    </Section>
  );
}
