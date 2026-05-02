import { H2, P, Strong, Code, Ul, Li, CalloutTip } from "./_prose";

export const meta = {
  slug: "hsts-and-why-we-turn-it-on",
  title: "What is HSTS, and why we always turn it on",
  summary:
    "A one-line header that closes a real attack window. Plain-language explanation of what it does, what it costs, and when it bites.",
  tags: ["security", "headers"],
  updatedAt: "2026-05-02",
  readingMinutes: 4,
};

export function Article() {
  return (
    <article>
      <P>
        HSTS — HTTP Strict Transport Security — is a single response header
        your site sends that tells browsers:{" "}
        <Strong>
          for the next year (or two, or five), only ever talk to me over
          HTTPS.
        </Strong>{" "}
        No fallback to plain HTTP, no exceptions, no warning prompts the
        user can click through.
      </P>

      <P>
        It looks like this in your response headers:
      </P>

      <P>
        <Code>
          Strict-Transport-Security: max-age=63072000; includeSubDomains;
          preload
        </Code>
      </P>

      <H2>What it actually prevents</H2>

      <P>
        Without HSTS, the very first time a browser visits your site, it
        usually tries plain HTTP, gets redirected to HTTPS, and remembers
        nothing for next time. That first request is wide open. Anyone on
        the same Wi-Fi can intercept it and serve their own page back —
        the user&apos;s browser has no idea your real site exists in
        encrypted form.
      </P>

      <P>
        HSTS plugs that hole on every visit <Em>after</Em> the first. The
        browser remembers your domain insists on HTTPS and refuses to
        downgrade — even if a man-in-the-middle tries to strip the
        encryption.
      </P>

      <H2>Three knobs, one decision</H2>

      <Ul>
        <Li>
          <Strong>max-age</Strong> — how long browsers should remember.
          We default to two years (<Code>63072000</Code> seconds). Anything
          under six months is too short to matter for the preload list;
          anything indefinite is fine.
        </Li>
        <Li>
          <Strong>includeSubDomains</Strong> — applies the policy to{" "}
          <Code>app.</Code>, <Code>admin.</Code>, anything else under your
          domain. We always turn this on.
        </Li>
        <Li>
          <Strong>preload</Strong> — opts your domain into a list browsers
          ship pre-baked, so even <Em>first-ever visits</Em> are protected.
          Once you&apos;re on it, you&apos;re committed for ~3 months
          minimum to come off.
        </Li>
      </Ul>

      <H2>When it bites</H2>

      <P>
        HSTS is one of those security primitives that&apos;s painless when
        your site is healthy and brutal when something&apos;s broken. If
        your TLS certificate expires, your subdomain accidentally serves
        plain HTTP, or you spin up a staging environment under your apex
        domain without HTTPS — every browser that&apos;s seen the HSTS
        header refuses to load it. No bypass. No way to click through.
      </P>

      <P>
        That&apos;s a feature, not a bug. The right response to a broken
        cert isn&apos;t &ldquo;let users through anyway&rdquo; — it&apos;s
        fix the cert. We monitor expiry on every domain we treat so it
        never happens by surprise.
      </P>

      <CalloutTip title="What we do with this">
        Every site we treat ships with HSTS, includeSubDomains, and preload
        once we&apos;ve confirmed all subdomains are on HTTPS. Mozilla
        Observatory checks for it and won&apos;t hand out an A+ without
        it.
      </CalloutTip>
    </article>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <em className="text-foreground">{children}</em>;
}
