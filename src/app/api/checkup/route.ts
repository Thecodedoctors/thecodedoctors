import { NextResponse } from "next/server";
import { runCheckup, CheckupValidationError, validationErrorResponse } from "@/lib/checkup/scanner";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs"; // node:dns + buffered fetch require Node, not Edge.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: { url?: unknown; turnstileToken?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad-json", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  if (typeof payload.url !== "string") {
    return NextResponse.json(
      { error: "url-required", message: "Please enter a URL." },
      { status: 400 }
    );
  }

  // Rate limit before doing any expensive work.
  const ip = clientKey(request);
  const limit = rateLimit(`checkup:${ip}`, { capacity: 6, refillPerSecond: 6 / 60 });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "rate-limited",
        message: "Slow down — wait a moment and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(limit.resetMs / 1000)),
        },
      }
    );
  }

  // Verify Turnstile when configured. Pass-through when not.
  const turnstileToken =
    typeof payload.turnstileToken === "string" ? payload.turnstileToken : undefined;
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

  try {
    const report = await runCheckup(payload.url);
    return NextResponse.json(report, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof CheckupValidationError) {
      const { status, body } = validationErrorResponse(err);
      return NextResponse.json(body, { status });
    }
    console.error("[checkup] scan failed", err);
    return NextResponse.json(
      {
        error: "scan-failed",
        message: "Something went wrong on our end. Try again in a moment.",
      },
      { status: 500 }
    );
  }
}
