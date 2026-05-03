import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logo concepts — preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Side-by-side preview of wordmark/logo directions for the Code Doctors
 * brand. Renders each concept on dark and light backgrounds, at three
 * sizes (header, hero, favicon-stand-in), so the founder can compare
 * versatility before we commit. NOINDEX, no marketing chrome.
 */
export default function LogoPreviewPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <header className="mb-16">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Logo concepts
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Six directions for the wordmark.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted">
            Each concept rendered at three sizes (hero, header, favicon-equivalent)
            against the dark brand background and an inverted light variant. Pick
            the one that feels most you — or tell me what to combine.
          </p>
        </header>

        <div className="space-y-20">
          <Concept
            id="A"
            name="Pure wordmark · period"
            note="Lowercase, tight tracking, single teal period at the end. Linear / Stripe / Vercel school. Most quietly confident; reads as 'we don't need decoration.'"
          >
            <LogoA size="hero" />
            <LogoA size="header" />
            <LogoA size="square" />
          </Concept>

          <Concept
            id="B"
            name="Wordmark + EKG pulse"
            note="A short EKG line in teal precedes the name. Reuses the pulse motif from your hero animation. Most explicit medical reference; still restrained."
          >
            <LogoB size="hero" />
            <LogoB size="header" />
            <LogoB size="square" />
          </Concept>

          <Concept
            id="C"
            name="Wordmark + medical plus"
            note="A teal '+' as the punctuation. Reads as both 'medical' and 'positive trajectory.' Crisp, geometric, recognisable at any size."
          >
            <LogoC size="hero" />
            <LogoC size="header" />
            <LogoC size="square" />
          </Concept>

          <Concept
            id="D"
            name="Stacked wordmark"
            note="Two-line set, justified-fit. Compact, square-friendly, works as a profile-pic / app-icon ratio. Period in teal."
          >
            <LogoD size="hero" />
            <LogoD size="header" />
            <LogoD size="square" />
          </Concept>

          <Concept
            id="E"
            name="Monogram + wordmark"
            note="A teal-ringed square with 'tcd' as the lockup. The square doubles as a favicon / app icon. Used by Notion, Loom, Cal.com."
          >
            <LogoE size="hero" />
            <LogoE size="header" />
            <LogoE size="square" />
          </Concept>

          <Concept
            id="F"
            name="Initials-only · graphic"
            note="Just 'tcd.' set large and tight. Boldest of the six. Strong as an icon-only mark; the wordmark becomes secondary."
          >
            <LogoF size="hero" />
            <LogoF size="header" />
            <LogoF size="square" />
          </Concept>
        </div>

        <footer className="mt-24 rounded-2xl border border-border bg-surface/30 p-6 text-sm text-muted">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            How to choose
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-foreground">
            <li>
              <span className="text-foreground">Picture it small.</span>{" "}
              <span className="text-muted">
                Browser tab, Slack avatar, mobile header. The favicon-size
                column is the hardest test — if it works there, it works.
              </span>
            </li>
            <li>
              <span className="text-foreground">Picture it large.</span>{" "}
              <span className="text-muted">
                Hero of a deck, footer of an invoice, OG card on Twitter.
                The hero column shows what people will share.
              </span>
            </li>
            <li>
              <span className="text-foreground">Say it out loud.</span>{" "}
              <span className="text-muted">
                Does the mark match the words &ldquo;calm, competent
                doctor&rdquo;? If it feels hype-y, it's wrong for this brand.
              </span>
            </li>
          </ol>
        </footer>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function Concept({
  id,
  name,
  note,
  children,
}: {
  id: string;
  name: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex items-baseline gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-soft font-mono text-xs text-accent ring-1 ring-inset ring-accent/30">
          {id}
        </span>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          {name}
        </h2>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted">{note}</p>

      {/* Dark surface */}
      <div
        className="rounded-2xl border border-border-strong bg-background"
        style={{ ["--fg" as string]: "#f2f4f7" } as React.CSSProperties}
      >
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {children}
        </div>
      </div>

      {/* Light surface — same components, --fg + --muted flipped so the
          wordmarks (and the cell labels) read on the inverted background. */}
      <div
        className="mt-3 rounded-2xl border border-[#e4e7ec] bg-[#f4f6f9]"
        style={
          {
            ["--fg" as string]: "#0a0e13",
            ["--muted" as string]: "#6b7280",
          } as React.CSSProperties
        }
      >
        <div className="grid divide-y divide-[#e4e7ec] md:grid-cols-3 md:divide-x md:divide-y-0">
          {children}
        </div>
      </div>
    </section>
  );
}

function Cell({
  size,
  children,
}: {
  size: "hero" | "header" | "square";
  children: React.ReactNode;
}) {
  const minH =
    size === "hero" ? "min-h-[220px]" : size === "header" ? "min-h-[120px]" : "min-h-[120px]";
  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-8 ${minH}`}>
      <div className="flex items-center justify-center">{children}</div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
        {size === "hero" ? "Hero" : size === "header" ? "Header" : "Favicon · 32px"}
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept A — pure wordmark with teal period.
   ──────────────────────────────────────────────────────────────────────── */

function LogoA({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <span className="font-sans text-[18px] font-semibold leading-none tracking-tight [color:var(--fg,#f2f4f7)]">
          tcd<span className="text-accent">.</span>
        </span>
      </Cell>
    );
  }
  const fontSize = size === "hero" ? "text-[44px]" : "text-[20px]";
  return (
    <Cell size={size}>
      <span
        className={`font-sans ${fontSize} font-semibold leading-none tracking-[-0.02em] [color:var(--fg,#f2f4f7)]`}
      >
        the code doctors<span className="text-accent">.</span>
      </span>
    </Cell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept B — wordmark with EKG pulse.
   ──────────────────────────────────────────────────────────────────────── */

function EKG({ width, height }: { width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M 0 12 L 14 12 L 18 12 L 22 4 L 28 20 L 34 8 L 38 16 L 44 12 L 60 12"
        stroke="#3dd9d6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function LogoB({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <div className="flex items-center gap-1.5">
          <EKG width={20} height={10} />
          <span className="font-sans text-[14px] font-semibold leading-none tracking-tight [color:var(--fg,#f2f4f7)]">
            tcd
          </span>
        </div>
      </Cell>
    );
  }
  const ekgW = size === "hero" ? 60 : 30;
  const ekgH = size === "hero" ? 24 : 14;
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  const gap = size === "hero" ? "gap-4" : "gap-2";
  return (
    <Cell size={size}>
      <div className={`flex items-center ${gap}`}>
        <EKG width={ekgW} height={ekgH} />
        <span
          className={`font-sans ${fontSize} font-semibold leading-none tracking-[-0.02em] [color:var(--fg,#f2f4f7)]`}
        >
          the code doctors
        </span>
      </div>
    </Cell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept C — wordmark + medical plus.
   ──────────────────────────────────────────────────────────────────────── */

function PlusMark({ s }: { s: number }) {
  // s = stroke-thickness; the mark is 5×s wide.
  return (
    <svg
      width={s * 5}
      height={s * 5}
      viewBox="0 0 5 5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M2.5 0.5 L2.5 4.5 M0.5 2.5 L4.5 2.5" stroke="#3dd9d6" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function LogoC({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <div className="flex items-center gap-1">
          <PlusMark s={3} />
          <span className="font-sans text-[14px] font-semibold leading-none tracking-tight [color:var(--fg,#f2f4f7)]">
            tcd
          </span>
        </div>
      </Cell>
    );
  }
  const s = size === "hero" ? 8 : 4;
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  const gap = size === "hero" ? "gap-3" : "gap-1.5";
  return (
    <Cell size={size}>
      <div className={`flex items-baseline ${gap}`}>
        <PlusMark s={s} />
        <span
          className={`font-sans ${fontSize} font-semibold leading-none tracking-[-0.02em] [color:var(--fg,#f2f4f7)]`}
        >
          the code doctors
        </span>
      </div>
    </Cell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept D — stacked two-line wordmark.
   ──────────────────────────────────────────────────────────────────────── */

function LogoD({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <span className="font-sans text-[15px] font-semibold leading-[0.95] tracking-[-0.03em] [color:var(--fg,#f2f4f7)] text-center">
          the code
          <br />
          doctors<span className="text-accent">.</span>
        </span>
      </Cell>
    );
  }
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  return (
    <Cell size={size}>
      <span
        className={`font-sans ${fontSize} font-semibold leading-[0.95] tracking-[-0.03em] [color:var(--fg,#f2f4f7)]`}
        style={{ display: "inline-block", textAlign: "left" }}
      >
        the code
        <br />
        doctors<span className="text-accent">.</span>
      </span>
    </Cell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept E — monogram square + wordmark lockup.
   ──────────────────────────────────────────────────────────────────────── */

function MonogramSquare({ size }: { size: number }) {
  return (
    <span
      className="grid place-items-center rounded-[6px] bg-accent text-background font-mono font-semibold leading-none tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      aria-hidden
    >
      tcd
    </span>
  );
}

function LogoE({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <MonogramSquare size={32} />
      </Cell>
    );
  }
  const sq = size === "hero" ? 56 : 28;
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  const gap = size === "hero" ? "gap-4" : "gap-2";
  return (
    <Cell size={size}>
      <div className={`flex items-center ${gap}`}>
        <MonogramSquare size={sq} />
        <span
          className={`font-sans ${fontSize} font-semibold leading-none tracking-[-0.02em] [color:var(--fg,#f2f4f7)]`}
        >
          the code doctors
        </span>
      </div>
    </Cell>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Concept F — initials only, graphic.
   ──────────────────────────────────────────────────────────────────────── */

function LogoF({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <span className="font-sans text-[24px] font-bold leading-none tracking-[-0.05em] [color:var(--fg,#f2f4f7)]">
          tcd<span className="text-accent">.</span>
        </span>
      </Cell>
    );
  }
  const fontSize = size === "hero" ? "text-[88px]" : "text-[32px]";
  const subFontSize = size === "hero" ? "text-sm" : "text-[10px]";
  return (
    <Cell size={size}>
      <div className="flex flex-col items-center gap-2">
        <span
          className={`font-sans ${fontSize} font-bold leading-none tracking-[-0.05em] [color:var(--fg,#f2f4f7)]`}
        >
          tcd<span className="text-accent">.</span>
        </span>
        <span
          className={`font-mono ${subFontSize} uppercase tracking-[0.24em] text-muted`}
        >
          the code doctors
        </span>
      </div>
    </Cell>
  );
}
