/**
 * Time formatting per PORTAL-SPEC.md §6.2.
 *
 *   < 60s           → "just now"
 *   < 60m           → "Nm"
 *   < 24h           → "Nh"
 *   < 7d            → "Nd"
 *   ≥ 7d            → localised short date ("Mar 14")
 *
 * Use `formatRelative()` everywhere a relative time appears. Pair with
 * `<time title={absoluteIso}>` in JSX so users can hover for the exact
 * timestamp.
 */

/** Shared placeholder for null/undefined/Invalid timestamps. Returning
 *  this instead of letting `new Date(undefined)` flow into
 *  `.toLocaleDateString()` (which throws `RangeError: Invalid time
 *  value`) keeps one bad/missing column from crashing a whole page. */
const NO_DATE = "—";

export function formatRelative(
  input: Date | string | number | null | undefined
): string {
  const d = toDate(input);
  if (!isValidDate(d)) return NO_DATE;
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);

  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Same as formatRelative but appends "ago" for non-instant cases. Use this
 * when the bare unit reads as ambiguous (e.g. column headers).
 */
export function formatRelativeAgo(
  input: Date | string | number | null | undefined
): string {
  const r = formatRelative(input);
  if (r === "just now" || r === NO_DATE) return r;
  if (/^\d+[mhd]$/.test(r)) return `${r} ago`;
  return r;
}

/**
 * Absolute timestamp for hover tooltips. ISO string (always serialisable).
 */
export function formatAbsolute(
  input: Date | string | number | null | undefined
): string {
  const d = toDate(input);
  return isValidDate(d) ? d.toISOString() : NO_DATE;
}

/**
 * Localised long form for date-of-record displays (audit log, billing, etc).
 *   2026-05-01T08:23:00Z → "May 1, 2026 at 8:23 AM" (locale-respecting)
 */
export function formatDateTime(
  input: Date | string | number | null | undefined
): string {
  const d = toDate(input);
  if (!isValidDate(d)) return NO_DATE;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDate(input: Date | string | number | null | undefined): Date {
  if (input instanceof Date) return input;
  if (input === null || input === undefined) return new Date(NaN);
  return new Date(input);
}

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}
