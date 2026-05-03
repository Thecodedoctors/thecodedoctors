import { site } from "@/lib/site";

/**
 * The Code Doctors brand mark: an EKG line between angle brackets.
 * Brackets read as code tags; the pulse inside reads as a heartbeat.
 *
 * Variants:
 *   - `full`  — mark + wordmark inline (default; use in headers, login, etc.)
 *   - `mark`  — the bracketed-pulse only (use in tight contexts)
 *   - `boxed` — bracketed-pulse locked into a teal-filled square +
 *               wordmark inline (use when you want the favicon-style
 *               lockup beside a name).
 *
 * `size` controls the mark height in pixels. Wordmark and SVG scale
 * proportionally so a single number is enough to set the whole thing.
 */
export function Logo({
  variant = "full",
  size = 22,
  className,
  withWordmark = true,
}: {
  variant?: "full" | "mark" | "boxed";
  size?: number;
  className?: string;
  /** Force-hide the wordmark even on `full` / `boxed`. */
  withWordmark?: boolean;
}) {
  if (variant === "mark") {
    return <BracketedPulse size={size} className={className} />;
  }

  if (variant === "boxed") {
    const boxPx = Math.round(size * 1.6);
    return (
      <span className={cx("inline-flex items-center gap-2.5", className)}>
        <BoxedPulse px={boxPx} />
        {withWordmark && <Wordmark size={size} />}
      </span>
    );
  }

  return (
    <span className={cx("inline-flex items-baseline gap-2", className)}>
      <BracketedPulse size={size} />
      {withWordmark && <Wordmark size={size} />}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

/** `<EKG>` — angle brackets in foreground, a single QRS-shape heartbeat
 *  in teal between them. Sized to the given mark height in pixels. */
function BracketedPulse({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  // Brackets are mono characters at `size` px. EKG fits the cap-height.
  const ekgW = Math.round(size * 0.85);
  const ekgH = Math.round(size * 0.55);
  const gap = Math.max(1, Math.round(size * 0.04));
  return (
    <span
      className={cx(
        "inline-flex items-center font-mono font-semibold leading-none tracking-[-0.03em] text-foreground",
        className
      )}
      style={{ fontSize: size, gap }}
      aria-hidden
    >
      <span>&lt;</span>
      <span className="text-accent inline-flex items-center">
        <PulseLine width={ekgW} height={ekgH} />
      </span>
      <span>&gt;</span>
    </span>
  );
}

/** Concept H: bracketed pulse inside a teal-filled rounded square.
 *  Both brackets and pulse are ink so they read on the fill. */
function BoxedPulse({ px }: { px: number }) {
  const fontPx = Math.round(px * 0.5);
  const ekgW = Math.round(px * 0.32);
  const ekgH = Math.round(px * 0.22);
  const gap = Math.max(1, Math.round(px * 0.04));
  return (
    <span
      className="grid place-items-center rounded-md bg-accent leading-none"
      style={{ width: px, height: px }}
      aria-hidden
    >
      <span
        className="inline-flex items-center font-mono font-semibold tracking-[-0.03em]"
        style={{ fontSize: fontPx, gap, color: "#0a0e13" }}
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

function Wordmark({ size }: { size: number }) {
  // Wordmark sits ~10% taller than the mark so the lockup feels balanced.
  return (
    <span
      className="font-sans font-semibold tracking-tight text-foreground"
      style={{ fontSize: Math.round(size * 1.05), lineHeight: 1 }}
    >
      {site.name}
    </span>
  );
}

/** A single QRS-style heartbeat: flatline · peak up · peak down · flatline.
 *  Stroke is `currentColor` so callers can tint via `text-*` classes. */
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

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}
