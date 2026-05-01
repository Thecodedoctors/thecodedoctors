import type { Metadata } from "next";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How we secure our infrastructure, our customers' data, and our practice.",
};

const measures = [
  {
    title: "Transport",
    items: [
      "HTTPS-only with HSTS preload",
      "TLS 1.3, modern ciphers only",
      "SSL Labs A+",
    ],
  },
  {
    title: "HTTP headers",
    items: [
      "Strict CSP, no unsafe-inline scripts",
      "X-Frame-Options DENY, COOP, CORP",
      "Permissions-Policy locks unused features",
      "Mozilla Observatory A+",
    ],
  },
  {
    title: "DNS & email",
    items: [
      "DNSSEC enabled",
      "CAA records lock cert issuance",
      "SPF, DKIM, DMARC enforced",
    ],
  },
  {
    title: "Application",
    items: [
      "All inputs validated server-side",
      "Parameterised queries only",
      "File uploads type/size checked, virus-scanned",
      "SSRF-protected diagnostic tool",
    ],
  },
  {
    title: "Identity",
    items: [
      "Mandatory 2FA for all staff accounts",
      "8-hour staff sessions, sliding expiry",
      "Breach-checked passwords (HIBP)",
      "Single-use magic links, 10-min expiry",
    ],
  },
  {
    title: "Edge",
    items: [
      "Cloudflare WAF + bot management + DDoS",
      "Per-IP rate limits on every public form",
      "Turnstile on every submission",
    ],
  },
  {
    title: "Operations",
    items: [
      "Append-only audit log on every staff mutation",
      "Sentry with PII scrubbing",
      "Daily encrypted backups, 30-day retention",
      "Incident response playbook",
    ],
  },
];

export const dynamic = "force-static";

export default function SecurityPage() {
  return (
    <Section size="lg">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Security Policy
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          How we secure things.
        </h1>
        <p className="mt-6 text-lg text-muted">
          We sell security, so our own posture is a pre-requisite, not a
          feature. Here&apos;s what we do, and what we expect of any
          infrastructure we touch.
        </p>

        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border-strong bg-border-strong">
          {measures.map((m) => (
            <div key={m.title} className="bg-surface p-7">
              <h2 className="text-lg font-semibold tracking-tight">
                {m.title}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {m.items.map((i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-accent"
                    />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h2 className="mt-16 text-2xl font-semibold tracking-tight">
          Found a vulnerability?
        </h2>
        <p className="mt-3 text-muted">
          We welcome reports from security researchers. Please email us at{" "}
          <a
            href="mailto:security@thecodedoctors.com"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            security@thecodedoctors.com
          </a>{" "}
          with details, and we&apos;ll respond within 72 hours. See our{" "}
          <a
            href="/.well-known/security.txt"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            security.txt
          </a>{" "}
          for the full disclosure policy.
        </p>
      </div>
    </Section>
  );
}
