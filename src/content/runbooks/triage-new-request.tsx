import { H2, P, Strong, Ul, Li, CalloutTip, Code } from "../_prose";

export const meta = {
  slug: "triage-new-request",
  title: "How to triage a new request",
  summary:
    "Every patient request starts at Triaged. The doctor who picks it up is responsible for moving it to Diagnosed within an hour during business hours.",
  tags: ["workflow", "triage"],
  updatedAt: "2026-05-02",
  readingMinutes: 3,
};

export function Article() {
  return (
    <article>
      <P>
        A request hits the inbox in <Code>triaged</Code> status. The first
        doctor to touch it owns moving it forward. The goal of triage isn&apos;t
        to fix anything yet — it&apos;s to confirm we have everything we
        need and form a hypothesis we can communicate.
      </P>

      <H2>Five-minute checklist</H2>

      <Ul>
        <Li>
          <Strong>Read the description completely</Strong> before opening
          the affected page. The patient&apos;s wording often points at
          the actual cause.
        </Li>
        <Li>
          <Strong>Open the URL in the request</Strong> in a private window
          and reproduce. If you can&apos;t reproduce, that&apos;s the
          first thing to ask the patient about — env, browser, time of
          day, payment method, account state.
        </Li>
        <Li>
          <Strong>Check the patient&apos;s site health</Strong> in the
          same tab. A reproducible bug + a recent down-event is usually
          the same incident.
        </Li>
        <Li>
          <Strong>Look at recent treatment history</Strong> on the
          patient detail page. If we touched something in this area in
          the last 30 days, the new request is probably related.
        </Li>
        <Li>
          <Strong>Pick a priority sanity-check</Strong>. Patients tend to
          file urgent on anything user-facing. Reset to the actual impact:
          revenue-affecting, security-affecting, time-sensitive deadline,
          or none of the above.
        </Li>
      </Ul>

      <H2>Moving it forward</H2>

      <P>
        Set status to <Code>diagnosed</Code> and reply on the request
        thread with one of three patterns:
      </P>

      <Ul>
        <Li>
          <Strong>Confirmed + plan</Strong> — &ldquo;Reproduced. Here&apos;s
          what&apos;s happening, here&apos;s the fix, here&apos;s the
          ETA.&rdquo; This is most cases.
        </Li>
        <Li>
          <Strong>Confirmed + question</Strong> — &ldquo;Reproduced.
          Before I treat, I need [the env it&apos;s happening on / a
          screenshot of the failing state / access to X].&rdquo; Don&apos;t
          start treatment until you have it.
        </Li>
        <Li>
          <Strong>Cannot reproduce</Strong> — &ldquo;Tried [these things],
          can&apos;t reproduce. Need [specific info].&rdquo; Don&apos;t
          fish; ask for one specific thing.
        </Li>
      </Ul>

      <CalloutTip title="The thread is the source of truth">
        Don&apos;t take diagnosis questions to email or DM. The thread on
        the request is the audited record. Future doctors and the patient
        themselves use it as context — keep it complete.
      </CalloutTip>
    </article>
  );
}
