import { site } from "@/lib/site";

/**
 * Shared visual template for Open Graph + Twitter cards. Rendered to a
 * 1200×630 PNG by `next/og`'s ImageResponse at request time. Each
 * route's `opengraph-image.tsx` calls this with its own title +
 * description so every shared link gets a card branded for that page.
 *
 * Constraints (Satori, the renderer behind ImageResponse):
 *   - Inline styles only — no Tailwind classes, no external CSS.
 *   - Every multi-child container needs `display: "flex"`.
 *   - Web fonts must be passed in via the ImageResponse `fonts` option;
 *     we use the system stack here so the worker doesn't need to fetch
 *     a font file on every render.
 *
 * Brand tokens are duplicated as literals (no `var(--accent)` access
 * inside the OG runtime), but kept in sync with `globals.css`.
 */

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const ink = "#0a0e13";
const surface = "#11161d";
const border = "#1f2733";
const fg = "#f2f4f7";
const muted = "#9aa4b2";
const accent = "#3dd9d6";

export const ogSize = { width: OG_WIDTH, height: OG_HEIGHT };
export const ogContentType = "image/png";

export function OgTemplate({
  eyebrow,
  title,
  description,
}: {
  /** Small uppercase mono caption above the title. Defaults to brand name. */
  eyebrow?: string;
  /** The main headline. Keep ≤ ~6 words for best layout. */
  title: string;
  /** One-sentence supporting description. Optional. */
  description?: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: ink,
        color: fg,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: "72px 80px",
        position: "relative",
      }}
    >
      {/* Soft accent glow, bottom-right */}
      <div
        style={{
          position: "absolute",
          right: -180,
          bottom: -180,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(61,217,214,0.22), rgba(61,217,214,0))",
          display: "flex",
        }}
      />

      {/* Subtle horizontal EKG flatline crossing the lower third */}
      <svg
        width={OG_WIDTH}
        height={OG_HEIGHT}
        viewBox={`0 0 ${OG_WIDTH} ${OG_HEIGHT}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <path
          d={`M 0 ${OG_HEIGHT * 0.62} L ${OG_WIDTH * 0.42} ${OG_HEIGHT * 0.62} L ${OG_WIDTH * 0.46} ${OG_HEIGHT * 0.5} L ${OG_WIDTH * 0.5} ${OG_HEIGHT * 0.74} L ${OG_WIDTH * 0.54} ${OG_HEIGHT * 0.46} L ${OG_WIDTH * 0.58} ${OG_HEIGHT * 0.62} L ${OG_WIDTH} ${OG_HEIGHT * 0.62}`}
          stroke={accent}
          strokeWidth="2"
          strokeOpacity="0.22"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* ── Brand lockup, top-left ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <BoxedPulse px={48} />
        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: fg,
          }}
        >
          {site.name}
        </span>
      </div>

      {/* ── Title block, vertically centered ───────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 920,
          marginTop: -24,
        }}
      >
        <span
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: accent,
            marginBottom: 22,
          }}
        >
          {eyebrow ?? site.name}
        </span>
        <span
          style={{
            fontSize: 76,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: fg,
          }}
        >
          {title}
        </span>
        {description && (
          <span
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: muted,
              marginTop: 26,
              maxWidth: 840,
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* ── Footer strip ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${border}`,
          paddingTop: 24,
          color: muted,
        }}
      >
        <span
          style={{
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 18,
            letterSpacing: "0.04em",
            color: muted,
          }}
        >
          {hostname(site.url)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 14,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: muted,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 99,
              background: accent,
              display: "flex",
            }}
          />
          {site.tagline}
        </span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

/** Boxed-pulse mark — same shape as the favicon, sized for the OG card. */
function BoxedPulse({ px }: { px: number }) {
  // Re-create the icon.svg paths inline so Satori can rasterize them.
  return (
    <div
      style={{
        width: px,
        height: px,
        display: "flex",
        background: accent,
        borderRadius: Math.round(px * 0.22),
      }}
    >
      <svg width={px} height={px} viewBox="0 0 32 32">
        <g
          stroke={ink}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <path d="M 8.5 10 L 5.5 16 L 8.5 22" />
          <path d="M 11 16 L 13 16 L 14.5 12.5 L 16 19.5 L 17.5 12 L 19 16 L 21 16" />
          <path d="M 23.5 10 L 26.5 16 L 23.5 22" />
        </g>
      </svg>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/* Indirect ref to silence unused-var when surface isn't visible. */
void surface;
