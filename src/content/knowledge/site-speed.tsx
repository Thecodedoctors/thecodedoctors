import { H2, P, Strong, Code, Ul, Li, CalloutTip } from "./_prose";

export const meta = {
  slug: "the-four-numbers-that-matter-for-site-speed",
  title: "The four numbers that actually matter for site speed",
  summary:
    "LCP, INP, CLS, TTFB — what each one measures, what good looks like, and which one to fix first.",
  tags: ["performance", "core-web-vitals"],
  updatedAt: "2026-05-02",
  readingMinutes: 5,
};

export function Article() {
  return (
    <article>
      <P>
        &ldquo;Make my site faster&rdquo; is one of those requests that
        dies in the implementation. Faster how? Faster for whom? On what
        hardware, what connection, which page? Without numbers, there&apos;s
        no way to know if a change actually helped.
      </P>

      <P>
        Google&apos;s Core Web Vitals give us four. Three are user-facing
        (the user feels the page load); one is server-facing (how quickly
        the server starts talking). Together they capture about 80% of
        what real users notice.
      </P>

      <H2>LCP — Largest Contentful Paint</H2>

      <P>
        How long until the biggest element above the fold finishes
        painting. Usually the hero image or the headline. If LCP is bad,
        the page <Strong>feels slow</Strong> — the user is staring at a
        skeleton or a half-rendered page.
      </P>

      <Ul>
        <Li>
          <Strong>Good:</Strong> under 2.5s
        </Li>
        <Li>
          <Strong>Needs work:</Strong> 2.5s – 4s
        </Li>
        <Li>
          <Strong>Bad:</Strong> over 4s
        </Li>
      </Ul>

      <P>
        Most LCP problems are one of three things: an unoptimised hero
        image (huge file, no <Code>preload</Code>, served from the wrong
        CDN), a render-blocking script in <Code>&lt;head&gt;</Code>, or a
        slow database query upstream of the HTML.
      </P>

      <H2>INP — Interaction to Next Paint</H2>

      <P>
        How long the page takes to respond when the user clicks, taps, or
        types. Replaced FID (First Input Delay) in 2024 because INP
        measures <Em>every</Em> interaction, not just the first one. If
        INP is bad, the page <Strong>feels janky</Strong> — buttons take
        a beat to respond, scrolling stutters.
      </P>

      <Ul>
        <Li>
          <Strong>Good:</Strong> under 200ms
        </Li>
        <Li>
          <Strong>Needs work:</Strong> 200ms – 500ms
        </Li>
        <Li>
          <Strong>Bad:</Strong> over 500ms
        </Li>
      </Ul>

      <P>
        INP is almost always a JavaScript problem. Too much code parsing
        at once, expensive event handlers, third-party scripts blocking
        the main thread. Fixing it usually means deferring or removing
        scripts you didn&apos;t realise were there.
      </P>

      <H2>CLS — Cumulative Layout Shift</H2>

      <P>
        How much the page jiggles around as it loads. The classic offender
        is an image without <Code>width</Code> and <Code>height</Code> —
        the browser reserves zero space for it, then everything below it
        shifts down when it finally loads. If CLS is bad, the user{" "}
        <Strong>misses the button they were about to click</Strong>.
      </P>

      <Ul>
        <Li>
          <Strong>Good:</Strong> under 0.1
        </Li>
        <Li>
          <Strong>Needs work:</Strong> 0.1 – 0.25
        </Li>
        <Li>
          <Strong>Bad:</Strong> over 0.25
        </Li>
      </Ul>

      <H2>TTFB — Time to First Byte</H2>

      <P>
        How quickly your server starts talking. This is the only one of
        the four that&apos;s mostly server-side. Slow TTFB usually points
        at hosting choices, a slow database query, or no edge cache where
        there could be one.
      </P>

      <Ul>
        <Li>
          <Strong>Good:</Strong> under 800ms
        </Li>
        <Li>
          <Strong>Needs work:</Strong> 800ms – 1.8s
        </Li>
        <Li>
          <Strong>Bad:</Strong> over 1.8s
        </Li>
      </Ul>

      <H2>Which one do you fix first?</H2>

      <P>The order we follow on a triage:</P>

      <Ul>
        <Li>
          <Strong>If TTFB is bad,</Strong> nothing else matters until
          it&apos;s fixed. Slow first byte makes every other metric look
          worse than it is.
        </Li>
        <Li>
          <Strong>Then LCP,</Strong> because users notice perceived load
          time before anything else.
        </Li>
        <Li>
          <Strong>Then CLS,</Strong> because misclicks are infuriating and
          cheap to fix (image dimensions, font preload).
        </Li>
        <Li>
          <Strong>Then INP,</Strong> because cleaning up JavaScript is
          patient work that usually requires architectural changes.
        </Li>
      </Ul>

      <CalloutTip title="What we do with this">
        We baseline all four numbers on every site we take on, set a
        budget per page, and treat any regression as a defect to be
        fixed before it ships. The Free Checkup tool surfaces the same
        metrics from the field — try it on yours.
      </CalloutTip>
    </article>
  );
}

function Em({ children }: { children: React.ReactNode }) {
  return <em className="text-foreground">{children}</em>;
}
