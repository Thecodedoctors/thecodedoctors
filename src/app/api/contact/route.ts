import { NextResponse } from "next/server";
import { recordLead } from "@/lib/leads";
import { clientKey } from "@/lib/rate-limit";
import { checkRateLimit } from "@/lib/rate-limit-db";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendBrandEmail } from "@/lib/email";
import { site } from "@/lib/site";
import { normalizeWebsiteUrl } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Marketing-side Contact form (lives at /book).
 *
 * Submissions are persisted as `leads` (source=book) for the founder's
 * follow-up workflow, and a notification email is sent to the practice
 * inbox immediately so we don't need to refresh a dashboard to see new
 * inquiries.
 *
 * Hardening:
 *   - Cloudflare Turnstile required (server-side verification)
 *   - 4 submissions per IP per 5 minutes (DB-backed rate limit, holds
 *     across worker isolates)
 *   - Field-length caps on every input to prevent stuffing
 *   - HTML escape on every value before composing the notification email
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = {
  name: 80,
  email: 254,
  phone: 40,
  position: 120,
  website: 256,
  subject: 200,
  message: 4000,
};

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "bad-json", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const firstName = str(payload.firstName, MAX.name);
  const lastName = str(payload.lastName, MAX.name);
  const email = str(payload.email, MAX.email).toLowerCase();
  const phone = str(payload.phone, MAX.phone);
  const position = str(payload.position, MAX.position);
  const companyWebsiteRaw = str(payload.companyWebsite, MAX.website);
  const subject = str(payload.subject, MAX.subject);
  const message = str(payload.message, MAX.message);
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";

  // Validation — every field is required.
  const missing: string[] = [];
  if (firstName.length < 1) missing.push("firstName");
  if (lastName.length < 1) missing.push("lastName");
  if (!EMAIL_RE.test(email)) missing.push("email");
  if (phone.length < 4) missing.push("phone");
  if (position.length < 1) missing.push("position");
  if (companyWebsiteRaw.length < 1) missing.push("companyWebsite");
  if (subject.length < 1) missing.push("subject");
  if (message.length < 10) missing.push("message");
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "validation",
        message:
          "Please fill in every field — message must be at least 10 characters.",
        missing,
      },
      { status: 400 }
    );
  }

  const companyWebsite = normalizeWebsiteUrl(companyWebsiteRaw) ?? companyWebsiteRaw;

  // Rate-limit by IP. 4 submissions per 5 minutes is generous enough for
  // a real prospect who fat-fingered, mean enough to discourage spam.
  const ip = clientKey(request);
  const limit = await checkRateLimit({
    scope: "contact",
    bucket: ip,
    limit: 4,
    windowSeconds: 300,
  });
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: "rate-limited",
        message: "Please wait a moment and try again.",
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  // Turnstile is the captcha. Server-side verification — never trust the
  // client. If TURNSTILE_SECRET_KEY isn't set the helper passes through
  // (dev convenience), but production deploys MUST set it.
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      {
        error: "captcha-failed",
        message: "Please complete the captcha and try again.",
      },
      { status: 400 }
    );
  }

  // Persist as a lead so it shows up in the admin pipeline. We stash all
  // the contact-form fields in `meta` since the canonical leads table
  // only has email/url/source — extra structure goes in the JSONB blob.
  await recordLead({
    email,
    url: companyWebsite,
    source: "book",
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    meta: {
      kind: "contact-form",
      firstName,
      lastName,
      phone,
      position,
      subject,
      message,
    },
  });

  // Notify the practice. Send-failure does NOT fail the request — the
  // lead is already persisted; the founder can find it in the admin
  // pipeline. We log the error for triage.
  let emailDelivered = false;
  try {
    await sendBrandEmail({
      to: site.emails.general,
      subject: `[Contact] ${subject} — ${firstName} ${lastName}`,
      html: composeContactNotification({
        firstName,
        lastName,
        email,
        phone,
        position,
        companyWebsite,
        subject,
        message,
      }),
    });
    emailDelivered = true;
  } catch (err) {
    console.error("[contact] email notify failed", err);
  }

  return NextResponse.json(
    {
      ok: true,
      message: emailDelivered
        ? "Message sent. We'll be in touch within one business day."
        : "Saved your details — a doctor will follow up by hand.",
    },
    { status: 200 }
  );
}

function composeContactNotification(args: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  companyWebsite: string;
  subject: string;
  message: string;
}): string {
  const e = escapeHtml;
  return `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0a0a0a;max-width:560px;line-height:1.6">
      <h2 style="margin:0 0 16px;font-size:18px;font-weight:600">New contact-form inquiry</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:140px">From</td><td style="padding:6px 0">${e(args.firstName)} ${e(args.lastName)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0"><a href="mailto:${e(args.email)}">${e(args.email)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${e(args.phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Position</td><td style="padding:6px 0">${e(args.position)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Company site</td><td style="padding:6px 0"><a href="${e(args.companyWebsite)}">${e(args.companyWebsite)}</a></td></tr>
        <tr><td style="padding:6px 0;color:#666">Subject</td><td style="padding:6px 0"><strong>${e(args.subject)}</strong></td></tr>
      </table>
      <div style="margin-top:20px;padding:16px;border:1px solid #e5e5e5;border-radius:8px;white-space:pre-wrap">${e(args.message)}</div>
      <p style="margin-top:20px;color:#999;font-size:12px">Reply directly to this email to respond.</p>
    </div>
  `;
}
