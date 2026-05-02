import { site } from "./site";

/**
 * Brand-styled transactional email templates per notification event.
 *
 * Voice: short, action-first, ≤ 250 words. Every email has exactly ONE
 * primary call-to-action button that deep-links into the relevant
 * portal surface. Reply-to is `hello@thecodedoctors.com` (set in
 * sendBrandEmail) so replies become support tickets in Phase 5.
 *
 * Per spec §8.3.
 */

const COLORS = {
  bg: "#0A0E13",
  surface: "#11161D",
  border: "#1f2733",
  fg: "#F2F4F7",
  muted: "#9AA4B2",
  accent: "#3DD9D6",
  accentSoft: "rgba(61, 217, 214, 0.12)",
  signal: "#F0584C",
  warning: "#F59E0B",
  success: "#4ADE80",
};

const PORTAL_URL = "https://app.thecodedoctors.com";
const ADMIN_URL = "https://admin.thecodedoctors.com";

export type EmailContent = { subject: string; html: string };

/* ──────────────────────────────────────────────────────────────────────────
   Patient-facing
   ──────────────────────────────────────────────────────────────────────── */

export function emailMessageReceived(args: {
  authorName: string;
  requestTitle: string;
  preview: string;
  requestId: string;
}): EmailContent {
  const subject = `${args.authorName} replied · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "New reply",
    title: `${escape(args.authorName)} replied on “${escape(args.requestTitle)}”`,
    body: `<p style="margin:0 0 8px 0;color:${COLORS.muted};font-size:14px;">Excerpt:</p>
           <blockquote style="margin:0;padding:12px 14px;border-left:3px solid ${COLORS.accent};background:${COLORS.surface};color:${COLORS.fg};font-size:14px;line-height:1.5;">${escape(args.preview)}</blockquote>`,
    cta: { label: "Read & reply", href: `${PORTAL_URL}/requests/${args.requestId}` },
  });
  return { subject, html };
}

export function emailStatusChanged(args: {
  requestTitle: string;
  newStatusLabel: string;
  requestId: string;
  needsApproval?: boolean;
}): EmailContent {
  const subject = args.needsApproval
    ? `Awaiting your approval · ${args.requestTitle}`
    : `${args.newStatusLabel} · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: args.needsApproval ? "Awaiting your approval" : "Status changed",
    title: args.needsApproval
      ? `Your doctor thinks “${escape(args.requestTitle)}” is done.`
      : `“${escape(args.requestTitle)}” is now ${escape(args.newStatusLabel)}.`,
    body: args.needsApproval
      ? `<p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.55;">Have a look and either approve to mark it resolved, or reply on the request if anything's still off.</p>`
      : "",
    cta: args.needsApproval
      ? { label: "Review the work", href: `${PORTAL_URL}/requests/${args.requestId}` }
      : { label: "View request", href: `${PORTAL_URL}/requests/${args.requestId}` },
  });
  return { subject, html };
}

export function emailRequestApproved(args: {
  requestTitle: string;
}): EmailContent {
  const subject = `Resolved · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "Resolved",
    title: `“${escape(args.requestTitle)}” is closed.`,
    body: `<p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.55;">Thanks for confirming. The request has been moved to your resolved file. If something's still off later, you can always submit a new request and reference this one.</p>`,
    cta: { label: "Submit a new request", href: `${PORTAL_URL}/requests/new` },
  });
  return { subject, html };
}

/* ──────────────────────────────────────────────────────────────────────────
   Staff-facing
   ──────────────────────────────────────────────────────────────────────── */

export function emailUrgentSubmitted(args: {
  clientName: string;
  requestTitle: string;
  requestId: string;
}): EmailContent {
  const subject = `URGENT · ${args.clientName} · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "Urgent · needs triage",
    title: `${escape(args.clientName)} submitted an urgent request.`,
    body: `<p style="margin:0;color:${COLORS.fg};font-size:15px;line-height:1.55;font-weight:500;">${escape(args.requestTitle)}</p>`,
    cta: { label: "Open in admin", href: `${ADMIN_URL}/requests/${args.requestId}` },
    accentColor: COLORS.signal,
  });
  return { subject, html };
}

export function emailNewRequestForStaff(args: {
  clientName: string;
  requestTitle: string;
  requestId: string;
}): EmailContent {
  const subject = `New request · ${args.clientName} · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "New request",
    title: `${escape(args.clientName)} just submitted a request.`,
    body: `<p style="margin:0;color:${COLORS.fg};font-size:15px;line-height:1.55;">${escape(args.requestTitle)}</p>`,
    cta: { label: "Triage this", href: `${ADMIN_URL}/requests/${args.requestId}` },
  });
  return { subject, html };
}

export function emailPatientReplied(args: {
  clientName: string;
  requestTitle: string;
  preview: string;
  requestId: string;
}): EmailContent {
  const subject = `Patient replied · ${args.clientName} · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "Patient replied",
    title: `${escape(args.clientName)} replied on “${escape(args.requestTitle)}”.`,
    body: `<blockquote style="margin:0;padding:12px 14px;border-left:3px solid ${COLORS.accent};background:${COLORS.surface};color:${COLORS.fg};font-size:14px;line-height:1.5;">${escape(args.preview)}</blockquote>`,
    cta: { label: "Read & reply", href: `${ADMIN_URL}/requests/${args.requestId}` },
  });
  return { subject, html };
}

export function emailRequestApprovedForStaff(args: {
  clientName: string;
  requestTitle: string;
}): EmailContent {
  const subject = `Patient approved · ${args.clientName} · ${args.requestTitle}`;
  const html = renderEmail({
    eyebrow: "Resolved",
    title: `${escape(args.clientName)} approved “${escape(args.requestTitle)}”.`,
    body: `<p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.55;">Marked resolved on their behalf. Nicely done.</p>`,
    cta: { label: "View archive", href: `${ADMIN_URL}` },
    accentColor: COLORS.success,
  });
  return { subject, html };
}

/* ──────────────────────────────────────────────────────────────────────────
   Site monitoring (staff)
   ──────────────────────────────────────────────────────────────────────── */

export function emailSiteWentDown(args: {
  clientName: string;
  url: string;
  error?: string | null;
}): EmailContent {
  const subject = `Site DOWN · ${args.clientName}`;
  const host = safeHostname(args.url);
  const html = renderEmail({
    eyebrow: "Site down",
    title: `${escape(host)} is unreachable.`,
    body: args.error
      ? `<p style="margin:0;padding:12px 14px;border-left:3px solid ${COLORS.signal};background:${COLORS.surface};color:${COLORS.fg};font-size:14px;line-height:1.5;font-family:ui-monospace,monospace;">${escape(args.error)}</p>`
      : `<p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.55;">No response from the site on the latest check. We'll keep checking and let you know when it's back.</p>`,
    cta: { label: "Open Fleet view", href: `${ADMIN_URL}/fleet` },
    accentColor: COLORS.signal,
  });
  return { subject, html };
}

export function emailSiteRecovered(args: {
  clientName: string;
  url: string;
  responseMs?: number | null;
}): EmailContent {
  const subject = `Site back up · ${args.clientName}`;
  const host = safeHostname(args.url);
  const html = renderEmail({
    eyebrow: "Site recovered",
    title: `${escape(host)} is responding again.`,
    body: args.responseMs
      ? `<p style="margin:0;color:${COLORS.muted};font-size:14px;line-height:1.55;">Latest response time: ${args.responseMs}ms.</p>`
      : "",
    cta: { label: "Open Fleet view", href: `${ADMIN_URL}/fleet` },
    accentColor: COLORS.success,
  });
  return { subject, html };
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared template renderer
   ──────────────────────────────────────────────────────────────────────── */

function renderEmail({
  eyebrow,
  title,
  body,
  cta,
  accentColor,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
  accentColor?: string;
}): string {
  const accent = accentColor ?? COLORS.accent;
  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:${COLORS.bg};color:${COLORS.fg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:16px;padding:32px;">
      <p style="color:${accent};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 12px 0;">${escape(eyebrow)}</p>
      <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.01em;margin:0 0 16px 0;color:${COLORS.fg};line-height:1.35;">${title}</h1>
      ${body ? `<div style="margin:16px 0 24px 0;">${body}</div>` : ""}
      <a href="${cta.href}" style="display:inline-block;background:${COLORS.fg};color:${COLORS.bg};padding:10px 20px;border-radius:999px;font-weight:500;text-decoration:none;font-size:14px;margin-top:8px;">${escape(cta.label)} →</a>
    </div>
    <p style="margin:24px 0 0 0;color:${COLORS.muted};font-size:11px;text-align:center;">
      ${site.name} — calm code maintenance for healthy sites<br/>
      <a href="${site.url}" style="color:${COLORS.muted};">${site.url}</a>
    </p>
  </div>
</body>
</html>`;
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
