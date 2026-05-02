import { H2, P, Strong, Ul, Li, CalloutTip, Code } from "../_prose";

export const meta = {
  slug: "new-patient-first-day",
  title: "Setting up a new patient: first 24 hours",
  summary:
    "When a new client arrives via /trial or /start, here's the standing checklist. Done well, the first day prevents most second-week problems.",
  tags: ["onboarding"],
  updatedAt: "2026-05-02",
  readingMinutes: 4,
};

export function Article() {
  return (
    <article>
      <P>
        Every new patient row triggers <Code>client.signed_up</Code> or
        <Code>client.trial_started</Code> in the audit log. Within 24
        hours of that event, the assigned doctor has these standing
        items.
      </P>

      <H2>Before you reach out</H2>

      <Ul>
        <Li>
          <Strong>Run a Free Checkup against their site.</Strong>{" "}
          The output is your starting point — a real signal of where
          their site stands today, before we do anything.
        </Li>
        <Li>
          <Strong>Open their patient detail page.</Strong> Confirm: the
          URL is correct, the plan matches what they signed up for,
          their primary contact email is real.
        </Li>
        <Li>
          <Strong>Set yourself as lead doctor.</Strong> Edit form,
          bottom of <Code>/admin/clients/[id]</Code>. They get one
          named doctor.
        </Li>
        <Li>
          <Strong>Add private notes.</Strong> Anything you want the
          team to know about this patient — niche industry, specific
          tooling, payment quirks. Notes never leak to the patient.
        </Li>
      </Ul>

      <H2>The intake message</H2>

      <P>
        Open a request on their behalf titled &ldquo;Welcome — your
        first treatment plan&rdquo;. In the body, include:
      </P>

      <Ul>
        <Li>
          <Strong>Three findings from the checkup</Strong> — the most
          impactful issues we&apos;ll address this week.
        </Li>
        <Li>
          <Strong>Your name + a real photo</Strong> if you have it on
          file. They signed up for a doctor, not a brand.
        </Li>
        <Li>
          <Strong>One question that requires their reply</Strong>. Forces
          them to engage with the portal early. Easier to keep an active
          patient active than to revive a quiet one.
        </Li>
      </Ul>

      <H2>If they&apos;re on a trial</H2>

      <P>
        The hub shows them a 7-day countdown automatically. You don&apos;t
        need to remind them — what you DO need to do is{" "}
        <Strong>ship a real fix in the first week</Strong>. Trials
        convert when the patient sees a tangible improvement. Pick the
        smallest, most visible win and treat it.
      </P>

      <CalloutTip title="The end-of-week check-in">
        On day 5 of a trial, the assigned doctor posts a recap on the
        intake thread: what we shipped, what we found, what we recommend
        next. This is the conversion moment. Most trials that convert,
        convert in the 36 hours after a strong recap.
      </CalloutTip>
    </article>
  );
}
