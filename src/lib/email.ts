import type { CheckupReport, CheckResult } from "./checkup/types";
import { site } from "./site";

/* ──────────────────────────────────────────────────────────────────────────
   Send via Resend — single shared transport.
   ──────────────────────────────────────────────────────────────────────── */

export async function sendBrandEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY not configured on the server. Set it in Cloudflare → Worker → Settings → Variables and Secrets."
    );
  }
  const fromAddress = process.env.RESEND_FROM ?? site.emails.general;

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `The Code Doctors <${fromAddress}>`,
        to: [to],
        reply_to: site.emails.general,
        subject,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Resend timed out (>8s) — try again in a moment.");
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 200);
    try {
      const body = JSON.parse(text) as { message?: string; name?: string };
      if (body.message) detail = body.message;
    } catch {
      /* keep raw text */
    }
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}

/**
 * Send the diagnostic report email. Wraps `sendBrandEmail` with the
 * scan-specific HTML template kept in this file.
 */
export async function sendCheckupReportEmail({
  to,
  report,
}: {
  to: string;
  report: CheckupReport;
}): Promise<void> {
  await sendBrandEmail({
    to,
    subject: `Your checkup report — ${new URL(report.finalUrl).hostname}`,
    html: renderReportHtml(report),
  });
}

function renderReportHtml(report: CheckupReport): string {
  const accent = "#3DD9D6";
  const bg = "#0A0E13";
  const fg = "#F2F4F7";
  const muted = "#9AA4B2";
  const surface = "#11161D";

  const checksHtml = report.checks
    .map((c) => renderCheckBlock(c, { accent, fg, muted, surface }))
    .join("");

  return `<!doctype html>
<html lang="en">
<body style="margin:0;background:${bg};color:${fg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;">
  <div style="max-width:640px;margin:0 auto;padding:32px;">
    <p style="color:${accent};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-family:ui-monospace,monospace;margin:0 0 12px 0;">Your Checkup</p>
    <h1 style="font-size:32px;font-weight:600;letter-spacing:-0.02em;margin:0 0 24px 0;">Diagnostic report — ${escapeHtml(new URL(report.finalUrl).hostname)}</h1>
    <div style="background:${surface};border:1px solid #1f2733;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="margin:0;color:${muted};font-size:13px;">Overall</p>
      <p style="margin:8px 0 0 0;font-family:ui-monospace,monospace;font-size:48px;font-weight:600;letter-spacing:-0.02em;">${report.overallScore}<span style="color:${muted};font-size:18px;margin-left:12px;">${report.overallGrade}</span></p>
    </div>
    ${checksHtml}
    <p style="margin:32px 0 0 0;color:${muted};font-size:13px;">
      Want us to fix these for you? Reply to this email or visit
      <a href="${site.url}/plans" style="color:${fg};">our treatment plans</a>.
    </p>
    <p style="margin:24px 0 0 0;color:${muted};font-size:11px;">
      ${site.name} · ${site.url}
    </p>
  </div>
</body>
</html>`;
}

function renderCheckBlock(
  c: CheckResult,
  colors: { accent: string; fg: string; muted: string; surface: string }
): string {
  const findingsHtml = c.findings
    .map(
      (f) => `
      <li style="margin:8px 0;color:${colors.muted};font-size:14px;">
        <strong style="color:${colors.fg};">${escapeHtml(f.title)}</strong>
        ${f.detail ? `<br/><span style="font-size:13px;">${escapeHtml(f.detail)}</span>` : ""}
      </li>`
    )
    .join("");

  return `
  <div style="background:${colors.surface};border:1px solid #1f2733;border-radius:16px;padding:24px;margin-bottom:16px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <h2 style="margin:0;font-size:18px;font-weight:600;letter-spacing:-0.01em;">${escapeHtml(c.name)}</h2>
      <p style="margin:0;font-family:ui-monospace,monospace;color:${colors.accent};">${c.score} · ${c.grade}</p>
    </div>
    <p style="margin:8px 0 16px 0;color:${colors.muted};font-size:14px;">${escapeHtml(c.summary)}</p>
    <ul style="margin:0;padding-left:18px;">${findingsHtml}</ul>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
