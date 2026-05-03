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

          <div className="rounded-2xl border border-accent/30 bg-accent-soft/20 p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              &lt; / &gt; · founder direction
            </p>
            <p className="mt-2 text-sm text-foreground">
              Angle brackets read as <span className="font-mono">code tags</span>;
              between them, an actual EKG line — a real heartbeat — in teal.
              Code containing a heartbeat. Below: four ways to land it.
            </p>
          </div>

          <Concept
            id="G"
            name="<EKG> mark + wordmark"
            note="The symbol set in mono with a real EKG line between the brackets, sans wordmark beside it. Most balanced — the symbol carries the meaning, the words carry the name."
          >
            <LogoG size="hero" />
            <LogoG size="header" />
            <LogoG size="square" />
          </Concept>

          <Concept
            id="H"
            name="<EKG> in a teal square"
            note="Brackets and pulse locked into a teal-filled square — both rendered in ink so they read on the fill. Doubles as favicon / app icon out of the box."
          >
            <LogoH size="hero" />
            <LogoH size="header" />
            <LogoH size="square" />
          </Concept>

          <Concept
            id="I"
            name="<EKG> standalone, wordmark as caption"
            note="The symbol blown up huge with the EKG line scaled to match, wordmark sized down to a caption underneath. Most distinctive — would be unmistakable in OG cards and presentations."
          >
            <LogoI size="hero" />
            <LogoI size="header" />
            <LogoI size="square" />
          </Concept>

          <Concept
            id="J"
            name="Wordmark · trailing <EKG>"
            note="The symbol used as punctuation after the wordmark — replacing the period in Concept A. The mark stays close to the words; reads cleanly in body text."
          >
            <LogoJ size="hero" />
            <LogoJ size="header" />
            <LogoJ size="square" />
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

/* ──────────────────────────────────────────────────────────────────────────
   Concept G — <EKG> mark + wordmark.
   Brackets are ink, the EKG line between them is teal so the pulse pops.
   ──────────────────────────────────────────────────────────────────────── */

/** A single QRS-style heartbeat: flatline · peak up · peak down · flatline.
 *  Stroke is currentColor so callers can tint via text-* classes. */
function PulseLine({ width, height }: { width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M 0 50 L 28 50 L 38 28 L 50 72 L 62 32 L 72 50 L 100 50"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PulseGlyph({
  size,
  bracketColor,
}: {
  size: "hero" | "header" | "square";
  bracketColor?: string;
}) {
  // Tuned per size so the bracket characters and the EKG sit on a shared baseline.
  const cfg = {
    hero:   { font: "text-[40px]", w: 36, h: 22, gap: "gap-1" },
    header: { font: "text-[18px]", w: 18, h: 11, gap: "gap-[3px]" },
    square: { font: "text-[15px]", w: 14, h: 9,  gap: "gap-[2px]" },
  }[size];
  return (
    <span
      className={`inline-flex items-center ${cfg.gap} font-mono ${cfg.font} font-semibold leading-none tracking-[-0.03em]`}
      style={{ color: bracketColor ?? "var(--fg, #f2f4f7)" }}
    >
      <span>&lt;</span>
      <span className="text-accent inline-flex items-center" aria-hidden>
        <PulseLine width={cfg.w} height={cfg.h} />
      </span>
      <span>&gt;</span>
    </span>
  );
}

function LogoG({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <PulseGlyph size="square" />
      </Cell>
    );
  }
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  const gap = size === "hero" ? "gap-3" : "gap-2";
  return (
    <Cell size={size}>
      <div className={`flex items-baseline ${gap}`}>
        <PulseGlyph size={size} />
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
   Concept H — <~> locked into a teal-filled square.
   Background is teal; brackets + tilde are ink so they read on the fill.
   ──────────────────────────────────────────────────────────────────────── */

function PulseSquare({ px }: { px: number }) {
  // Inside-the-square sizing: brackets at ~50% of the box, EKG line ~30% wide.
  const fontPx = Math.round(px * 0.5);
  const ekgW = Math.round(px * 0.32);
  const ekgH = Math.round(px * 0.22);
  const gapPx = Math.max(1, Math.round(px * 0.04));
  return (
    <span
      className="grid place-items-center rounded-[6px] bg-accent leading-none"
      style={{ width: px, height: px }}
      aria-hidden
    >
      <span
        className="inline-flex items-center"
        style={{
          gap: gapPx,
          fontSize: fontPx,
          color: "#0a0e13",
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontWeight: 600,
          letterSpacing: "-0.03em",
        }}
      >
        <span>&lt;</span>
        <span className="inline-flex items-center" style={{ color: "#0a0e13" }}>
          <PulseLine width={ekgW} height={ekgH} />
        </span>
        <span>&gt;</span>
      </span>
    </span>
  );
}

function LogoH({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <PulseSquare px={32} />
      </Cell>
    );
  }
  const sq = size === "hero" ? 56 : 28;
  const fontSize = size === "hero" ? "text-[40px]" : "text-[18px]";
  const gap = size === "hero" ? "gap-4" : "gap-2";
  return (
    <Cell size={size}>
      <div className={`flex items-center ${gap}`}>
        <PulseSquare px={sq} />
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
   Concept I — <~> blown up huge, wordmark below as caption.
   ──────────────────────────────────────────────────────────────────────── */

function LogoI({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <PulseGlyph size="square" />
      </Cell>
    );
  }
  // Hero/header use a larger custom layout with bigger brackets + bigger EKG.
  const cfg =
    size === "hero"
      ? { font: 88, ekgW: 80, ekgH: 50, gapPx: 6 }
      : { font: 32, ekgW: 30, ekgH: 19, gapPx: 4 };
  const subFontSize = size === "hero" ? "text-sm" : "text-[10px]";
  return (
    <Cell size={size}>
      <div className="flex flex-col items-center gap-2">
        <span
          className="inline-flex items-center font-mono font-semibold leading-none tracking-[-0.05em]"
          style={{
            fontSize: cfg.font,
            gap: cfg.gapPx,
            color: "var(--fg, #f2f4f7)",
          }}
        >
          <span>&lt;</span>
          <span className="text-accent inline-flex items-center" aria-hidden>
            <PulseLine width={cfg.ekgW} height={cfg.ekgH} />
          </span>
          <span>&gt;</span>
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

/* ──────────────────────────────────────────────────────────────────────────
   Concept J — wordmark with trailing <~> as punctuation.
   ──────────────────────────────────────────────────────────────────────── */

function LogoJ({ size }: { size: "hero" | "header" | "square" }) {
  if (size === "square") {
    return (
      <Cell size={size}>
        <span
          className="inline-flex items-center font-sans text-[15px] font-semibold leading-none tracking-tight [color:var(--fg,#f2f4f7)]"
          style={{ gap: 3 }}
        >
          tcd
          <span className="inline-flex items-center font-mono" style={{ gap: 1 }}>
            <span>&lt;</span>
            <span className="text-accent inline-flex items-center" aria-hidden>
              <PulseLine width={10} height={6} />
            </span>
            <span>&gt;</span>
          </span>
        </span>
      </Cell>
    );
  }
  const cfg =
    size === "hero"
      ? { wordPx: 40, markPx: 28, ekgW: 24, ekgH: 14, outerGap: 8, innerGap: 3 }
      : { wordPx: 18, markPx: 14, ekgW: 12, ekgH: 7, outerGap: 4, innerGap: 1.5 };
  return (
    <Cell size={size}>
      <div className="flex items-center" style={{ gap: cfg.outerGap }}>
        <span
          className="font-sans font-semibold leading-none tracking-[-0.02em] [color:var(--fg,#f2f4f7)]"
          style={{ fontSize: cfg.wordPx }}
        >
          the code doctors
        </span>
        <span
          className="inline-flex items-center font-mono font-semibold leading-none tracking-[-0.03em] [color:var(--fg,#f2f4f7)]"
          style={{ fontSize: cfg.markPx, gap: cfg.innerGap }}
        >
          <span>&lt;</span>
          <span className="text-accent inline-flex items-center" aria-hidden>
            <PulseLine width={cfg.ekgW} height={cfg.ekgH} />
          </span>
          <span>&gt;</span>
        </span>
      </div>
    </Cell>
  );
}
