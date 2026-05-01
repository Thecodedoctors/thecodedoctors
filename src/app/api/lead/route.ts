import { NextResponse } from "next/server";
import { recordLead } from "@/lib/leads";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { sendCheckupReportEmail } from "@/lib/email";
import type { CheckupReport } from "@/lib/checkup/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let payload: {
    email?: unknown;
    url?: unknown;
    source?: unknown;
    report?: unknown;
    turnstileToken?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad-json", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  if (typeof payload.email !== "string" || !EMAIL_RE.test(payload.email)) {
    return NextResponse.json(
      { error: "email-invalid", message: "Please enter a valid email." },
      { status: 400 }
    );
  }

  const email = payload.email.toLowerCase().trim();
  if (email.length > 254) {
    return NextResponse.json(
      { error: "email-invalid", message: "Email is too long." },
      { status: 400 }
    );
  }

  const ip = clientKey(request);
  const limit = rateLimit(`lead:${ip}`, { capacity: 4, refillPerSecond: 4 / 300 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate-limited", message: "Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.resetMs / 1000)) } }
    );
  }

  const turnstile = await verifyTurnstile(
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : undefined,
    ip
  );
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: "captcha-failed", message: "Please complete the captcha." },
      { status: 400 }
    );
  }

  const source =
    payload.source === "checkup" ||
    payload.source === "book" ||
    payload.source === "newsletter"
      ? payload.source
      : "other";
  const url = typeof payload.url === "string" ? payload.url : undefined;
  const report =
    payload.report && typeof payload.report === "object"
      ? (payload.report as CheckupReport)
      : undefined;

  await recordLead({
    email,
    url,
    source,
    ip,
    userAgent: request.headers.get("user-agent") ?? undefined,
    meta: report ? { overallScore: report.overallScore, overallGrade: report.overallGrade } : undefined,
  });

  // Wait for the email send so we can tell the visitor whether it actually
  // delivered. Lead is already persisted, so even if the send fails the
  // contact info isn't lost — a doctor follows up by hand.
  let emailDelivered = false;
  let emailError: string | undefined;
  if (report) {
    try {
      await sendCheckupReportEmail({ to: email, report });
      emailDelivered = true;
    } catch (err) {
      emailError =
        err instanceof Error ? err.message.slice(0, 180) : "send-failed";
      console.error("[lead] failed to send report email", err);
    }
  } else {
    // No report payload (e.g., book/newsletter form) — nothing to email.
    emailDelivered = true;
  }

  return NextResponse.json(
    {
      ok: true,
      message: emailDelivered
        ? "Sent. Check your inbox in the next minute or two."
        : "Saved your details — automated email send failed; a doctor will follow up by hand.",
      emailDelivered,
      emailError,
    },
    { status: 200 }
  );
}
