import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, AlertCircle, KeyRound, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  verifyEmailWithToken,
  verifyEmailWithCode,
  resendVerificationCode,
} from "@/server/email-verification";
import { resolvePortalRedirect } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  token?: string;
  error?: string;
  resent?: string;
}>;

/**
 * Email verification page. Two paths:
 *
 * 1. Magic link — /verify-email?token=<token>. We verify on the server
 *    (no auth required, the token itself is the proof) and either redirect
 *    to /dashboard with a success flag or show the error inline.
 * 2. Code entry — patient is signed in, lands on /verify-email, types
 *    the 6-digit code from the email, submits the form. The action
 *    flips emailVerified to NOW and redirects to /dashboard.
 *
 * Resend is a separate server action triggered by the "Resend code"
 * button. Rate-limited to 5/day per user.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  // Magic-link path — verify the token, then bounce.
  if (sp.token) {
    const result = await verifyEmailWithToken(sp.token);
    if (result.ok) {
      redirect(resolvePortalRedirect("/dashboard?verified=just-now"));
    }
    return (
      <Shell>
        <div className="rounded-2xl border border-signal/30 bg-signal/5 p-7">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-signal" />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                Couldn&apos;t verify
              </p>
              <p className="mt-2 text-sm text-foreground">{result.error}</p>
            </div>
          </div>
          <p className="mt-5 text-xs text-muted">
            Sign in and request a fresh code from your dashboard.
          </p>
          <Button
            href="/login"
            variant="primary"
            size="md"
            className="mt-4 w-full"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Shell>
    );
  }

  // Code-entry path — needs an authenticated session.
  const session = await auth();
  if (!session?.user) {
    redirect("/login?next=/verify-email");
  }

  return (
    <Shell>
      <div className="rounded-2xl border border-border-strong bg-surface/60 p-7">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Verify your email
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Almost there.
        </h1>
        <p className="mt-2 text-sm text-muted">
          We sent a 6-digit code to{" "}
          <span className="font-mono text-foreground">
            {session.user.email}
          </span>
          . Enter it below, or click the link in the email instead.
        </p>

        {sp.resent === "1" && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-xs text-foreground">
              Fresh code on its way — give it a minute.
            </p>
          </div>
        )}

        {sp.error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <p className="text-xs text-foreground">{errorCopy(sp.error)}</p>
          </div>
        )}

        <form action={verifyEmailWithCode} className="mt-6 space-y-3">
          <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-accent/60 focus-within:ring-accent">
            <KeyRound className="h-4 w-4 shrink-0 text-accent" />
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              required
              autoFocus
              maxLength={6}
              placeholder="6-digit code"
              aria-label="Verification code"
              className="w-full bg-transparent font-mono tracking-widest text-foreground outline-none placeholder:text-muted placeholder:font-sans placeholder:tracking-normal text-sm"
            />
          </label>
          <Button type="submit" size="md" variant="primary" className="w-full">
            Verify
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <form action={resendVerificationCode} className="mt-4 text-center">
          <button
            type="submit"
            className="text-xs text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent"
          >
            Didn&apos;t get the email? Resend the code
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Wrong email?{" "}
        <Link
          href="/dashboard/settings"
          className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          Change it in settings
        </Link>{" "}
        — then resend.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="The Code Doctors home"
          className="mb-10 inline-block"
        >
          <Logo size={20} />
        </Link>
        {children}
      </div>
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "bad-code":
      return "Enter the 6 digits from the email — letters won't work.";
    case "no-code":
      return "We don't have a code on file for you. Hit Resend below.";
    case "expired":
      return "That code expired. Hit Resend below for a fresh one.";
    case "wrong-code":
      return "That code doesn't match. Try again, or use the magic link in the email.";
    case "too-many-attempts":
      return "Too many wrong attempts on this code. Hit Resend for a fresh one.";
    case "rate-limited":
      return "Too many resend requests. Try again tomorrow, or check your spam folder.";
    case "send-failed":
      return "We couldn't send the email — try again in a minute.";
    case "not-found":
      return "We couldn't find your account. Sign in and try again.";
    default:
      return "Something went wrong — try again.";
  }
}
