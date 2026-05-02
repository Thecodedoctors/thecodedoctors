import { H2, P, Strong, Ul, Li, CalloutTip, Code } from "../_prose";

export const meta = {
  slug: "site-down-recovery",
  title: "When a site goes down: the recovery checklist",
  summary:
    "The Fleet alert strip just lit up. Here's the order of operations before you reach for the patient.",
  tags: ["incident", "recovery"],
  updatedAt: "2026-05-02",
  readingMinutes: 4,
};

export function Article() {
  return (
    <article>
      <P>
        When the red Fleet Alert strip appears on <Code>/admin</Code>, a
        patient site has flipped from up to down for at least one check
        cycle. The patient already received an in-app notification + a
        red email. Don&apos;t panic, but move.
      </P>

      <H2>First 60 seconds</H2>

      <Ul>
        <Li>
          <Strong>Open Fleet</Strong> from the alert strip — that&apos;s
          where the diagnostic for each affected client lives.
        </Li>
        <Li>
          <Strong>Try the URL yourself.</Strong> Sometimes our edge
          worker is wrong — the cron probe failed but the site is fine
          for users. Verify before alarming the patient.
        </Li>
        <Li>
          <Strong>Click &ldquo;Check now&rdquo;</Strong> on the row. A
          fresh check returns immediately. If two consecutive fresh
          checks pass, mark it as a transient probe failure and move on.
        </Li>
      </Ul>

      <H2>If it really is down</H2>

      <Ul>
        <Li>
          <Strong>SSL/cert?</Strong>{" "}
          <Code>openssl s_client -connect host:443</Code> reveals expired
          or self-signed certs in two seconds. Most common cause for
          sites we don&apos;t host.
        </Li>
        <Li>
          <Strong>DNS?</Strong>{" "}
          <Code>dig +short A host</Code> — if it returns nothing, the DNS
          record is gone or the registrar is down. Check the patient&apos;s
          registrar.
        </Li>
        <Li>
          <Strong>Origin?</Strong> If they&apos;re behind Cloudflare and
          the origin is failing, CF returns 521/522/523. Tells you it&apos;s
          their hosting.
        </Li>
        <Li>
          <Strong>Application?</Strong> 500/502/504 with a small body
          means the app errored. They have logs.
        </Li>
      </Ul>

      <H2>Tell the patient something useful</H2>

      <P>
        Reply on a NEW request thread (or open one yourself titled
        &ldquo;Site down — [domain] — [time]&rdquo;) with{" "}
        <Strong>what we know, what we&apos;re doing, what we need from
        them</Strong>. Patients in the middle of an outage want three
        sentences, not five paragraphs. Status updates every 10 min.
      </P>

      <CalloutTip title="When to escalate to the founder">
        Anything that&apos;s been down 30+ minutes, anything affecting a
        Premium Care patient regardless of duration, anything where we
        don&apos;t have a hypothesis after 15 minutes of looking. Pull
        the rip cord — extra hands shorten incidents.
      </CalloutTip>
    </article>
  );
}
