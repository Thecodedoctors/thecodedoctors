import { H2, P, Strong, Code, Ul, Li, CalloutTip } from "./_prose";

export const meta = {
  slug: "why-your-site-needs-security-txt",
  title: "Why your site needs a security.txt",
  summary:
    "A 6-line file at /.well-known/security.txt that gives security researchers a way to report vulnerabilities to you instead of dropping them on Twitter.",
  tags: ["security", "disclosure"],
  updatedAt: "2026-05-02",
  readingMinutes: 3,
};

export function Article() {
  return (
    <article>
      <P>
        Imagine someone finds a real vulnerability in your site. Maybe
        it&apos;s a leaky API endpoint, maybe an exposed admin panel,
        maybe a misconfigured S3 bucket. They want to tell you. They go
        to your homepage. They click around. They look at{" "}
        <Code>/contact</Code>. They check your{" "}
        <Code>about</Code>. Nothing. They look at your domain registrar.
        Privacy-protected. They give up — or they post it publicly so
        someone, somewhere, eventually fixes it.
      </P>

      <P>
        <Strong>security.txt</Strong> exists so that doesn&apos;t happen
        to you.
      </P>

      <H2>What it is</H2>

      <P>
        A plain-text file served at{" "}
        <Code>https://yoursite.com/.well-known/security.txt</Code>. It
        tells security researchers: here&apos;s how to reach me, here&apos;s
        how to verify it&apos;s really me, here&apos;s how long this
        information is valid.
      </P>

      <P>
        Ours looks roughly like:
      </P>

      <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-foreground/90">
{`Contact: mailto:security@thecodedoctors.com
Expires: 2027-01-01T00:00:00.000Z
Preferred-Languages: en
Canonical: https://thecodedoctors.com/.well-known/security.txt
Policy: https://thecodedoctors.com/security`}
      </pre>

      <H2>Why it matters more than it looks</H2>

      <Ul>
        <Li>
          <Strong>It surfaces the right inbox.</Strong> Reports go to a
          monitored mailbox, not a contact form that someone reads on
          Mondays.
        </Li>
        <Li>
          <Strong>It signals you take this seriously.</Strong> Security
          researchers fingerprint domains for a security.txt before they
          reach out. Its absence quietly says &ldquo;don&apos;t bother;
          they won&apos;t respond&rdquo;.
        </Li>
        <Li>
          <Strong>It documents your disclosure policy.</Strong> Linking
          to a clear page that says &ldquo;here&apos;s what we promise,
          here&apos;s what we ask&rdquo; turns a chaotic email exchange
          into a known process.
        </Li>
      </Ul>

      <H2>What &ldquo;valid&rdquo; means</H2>

      <P>
        The <Code>Expires</Code> field is the part most sites get wrong.
        It must be a real RFC 3339 timestamp in the future — not in the
        past, not missing, not vague. The file is meant to be re-issued
        annually so its contact info doesn&apos;t silently rot. We set
        ours a year out and renew on the calendar.
      </P>

      <CalloutTip title="What we do with this">
        Every site we treat ships with a security.txt at{" "}
        <Code>/.well-known/security.txt</Code>, a monitored security
        mailbox, and a public security policy page. Mozilla Observatory
        rewards it; serious security researchers expect it; it costs
        you nothing.
      </CalloutTip>
    </article>
  );
}
