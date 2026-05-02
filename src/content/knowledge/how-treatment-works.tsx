import { H2, P, Strong, Ul, Li, CalloutTip } from "../_prose";

export const meta = {
  slug: "how-treatment-works",
  title: "How a request becomes a fix",
  summary:
    "Triage → Diagnosis → Treatment → Review → Resolution. The five stages every request moves through, and what to expect at each one.",
  tags: ["workflow", "process"],
  updatedAt: "2026-05-02",
  readingMinutes: 3,
};

export function Article() {
  return (
    <article>
      <P>
        Every request you submit moves through the same five stages. We
        called them after the medical workflow on purpose — calm,
        sequential, no shortcuts. Here&apos;s what happens at each, and
        what to expect from us.
      </P>

      <H2>1. Triaged · &ldquo;New&rdquo;</H2>

      <P>
        The moment you submit a request, it lands in our practice inbox
        with status <Strong>Triaged</Strong>. A doctor will pick it up
        within an hour during business hours, faster if you flagged it
        urgent. We&apos;re not working on it yet — we&apos;re reading,
        understanding, asking ourselves: what&apos;s the smallest fix
        that resolves this?
      </P>

      <H2>2. Diagnosed · &ldquo;Reviewed&rdquo;</H2>

      <P>
        Once we&apos;ve formed a hypothesis about what&apos;s wrong and
        what we need to do, we move it to <Strong>Diagnosed</Strong>{" "}
        and reply to you with that hypothesis. This is where we either
        confirm we have everything we need, or ask for the one detail
        that&apos;s missing.
      </P>

      <H2>3. In treatment · &ldquo;In progress&rdquo;</H2>

      <P>
        We&apos;re working. The change is being made, tested locally,
        reviewed by a second doctor if it touches anything load-bearing.
        Average time-in-treatment depends on the complexity, but we keep
        you posted on the same thread — no separate status emails, no
        portal hunting.
      </P>

      <H2>4. In review · &ldquo;Awaiting your approval&rdquo;</H2>

      <P>
        The fix is shipped to your site. We&apos;ve sanity-checked it,
        but we don&apos;t close anything until you&apos;ve looked too.
        The request status flips to <Strong>Awaiting your approval</Strong>{" "}
        and you get an email. Two ways to respond:
      </P>

      <Ul>
        <Li>
          <Strong>Approve</Strong> — closes the request and moves it to
          your resolved file.
        </Li>
        <Li>
          <Strong>Reply with changes</Strong> — sends it back into
          treatment without losing the thread.
        </Li>
      </Ul>

      <H2>5. Healed · &ldquo;Resolved&rdquo;</H2>

      <P>
        The request is closed and indexed. It still lives in your
        archive — searchable, copyable, useful when you need to remember
        what we changed and why. If something related comes up later,
        reference the old request and we can pick up the context fast.
      </P>

      <CalloutTip title="What this means for you">
        You don&apos;t have to track status — we do. You&apos;ll know
        when something needs your input because the request flips into
        a state that&apos;s waiting on you, and we send a notification.
        Otherwise, expect us to keep moving.
      </CalloutTip>
    </article>
  );
}
