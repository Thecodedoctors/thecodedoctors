import { H2, P, Strong, Ul, Li, CalloutTip, Code } from "../_prose";

export const meta = {
  slug: "handling-urgent-requests",
  title: "Handling urgent requests: response SLAs",
  summary:
    "What our urgent-priority commitment actually looks like in practice. Reading time saves you minutes when one lands.",
  tags: ["urgent", "sla"],
  updatedAt: "2026-05-02",
  readingMinutes: 3,
};

export function Article() {
  return (
    <article>
      <P>
        The patient marked something urgent. They get an explicit promise
        in the marketing copy: &ldquo;same-day response on Premium, faster
        on emergencies.&rdquo; Live up to it.
      </P>

      <H2>Acknowledge within 15 minutes</H2>

      <P>
        Even if you can&apos;t fix it yet, the patient gets a reply on
        the thread within 15 minutes during business hours, 30 minutes
        out of hours. The acknowledgement says three things:
      </P>

      <Ul>
        <Li>
          <Strong>I&apos;ve seen this and I&apos;m working on it</Strong>
          {" "}— with your name, so they know who.
        </Li>
        <Li>
          <Strong>What I&apos;m doing right now</Strong> — even if
          it&apos;s &ldquo;reproducing locally&rdquo; or &ldquo;reading
          your logs.&rdquo;
        </Li>
        <Li>
          <Strong>When I&apos;ll next update them</Strong> — a real
          time, not &ldquo;soon.&rdquo; Default to 30 min if you have
          no better answer.
        </Li>
      </Ul>

      <H2>Self-assign immediately</H2>

      <P>
        Click &ldquo;Assign to me&rdquo; in the staff toolbar. Two
        reasons: the patient sees their doctor by name, and other staff
        know it&apos;s being handled (no double-work, no &ldquo;is
        someone on this?&rdquo;).
      </P>

      <H2>Communicate every state change</H2>

      <P>
        Move the request through statuses as you progress:{" "}
        <Code>triaged</Code> → <Code>diagnosed</Code> →{" "}
        <Code>in_treatment</Code> → <Code>in_review</Code>. Each transition
        fires a notification. Patients in an outage feel calmer when they
        see a state machine progressing instead of silence.
      </P>

      <H2>If it&apos;s out of hours</H2>

      <Ul>
        <Li>
          <Strong>Premium Care</Strong> — full response, no different
          from business hours.
        </Li>
        <Li>
          <Strong>General Care</Strong> — acknowledge within 30 min,
          then follow up first thing next business day unless the issue
          is revenue-bleeding (in which case treat it as Premium for
          this incident).
        </Li>
        <Li>
          <Strong>Free Checkup / lead</Strong> — acknowledge by next
          business day. Set expectations clearly.
        </Li>
      </Ul>

      <CalloutTip title="The 90-second rule">
        For anything urgent, reading the request + opening the
        affected page + posting an acknowledgement should take under
        90 seconds. If it took longer, you got distracted. Refocus and
        ship the ack first; investigation second.
      </CalloutTip>
    </article>
  );
}
