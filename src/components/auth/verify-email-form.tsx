"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, KeyRound, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  verifyEmailWithCode,
  resendVerificationCode,
} from "@/server/email-verification";

/**
 * Code-entry + resend, in place. A wrong code or a resend now renders
 * an inline result with the page mounted (no reload, focus kept, no
 * ?error= bounce) and both buttons show a pending state so a double
 * click can't burn a second code / a second resend from the 5/day cap.
 * Success still server-redirects to the dashboard.
 */
export function VerifyEmailForm({ email }: { email: string }) {
  const [codeState, codeAction] = useActionState(verifyEmailWithCode, null);
  const [resendState, resendAction] = useActionState(
    resendVerificationCode,
    null
  );

  return (
    <div className="rounded-2xl border border-border-strong bg-surface/60 p-7">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        Verify your email
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Almost there.
      </h1>
      <p className="mt-2 text-sm text-muted">
        We sent a 6-digit code to{" "}
        <span className="font-mono text-foreground">{email}</span>. Enter it
        below, or click the link in the email instead.
      </p>

      {resendState?.ok && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs text-foreground">
            Fresh code on its way — give it a minute.
          </p>
        </div>
      )}
      {resendState && !resendState.ok && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">
            {errorCopy(resendState.error)}
          </p>
        </div>
      )}
      {codeState && !codeState.ok && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">
            {errorCopy(codeState.error)}
          </p>
        </div>
      )}

      <form action={codeAction} className="mt-6 space-y-3">
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
        <VerifyButton />
      </form>

      <form action={resendAction} className="mt-4 text-center">
        <ResendButton />
      </form>
    </div>
  );
}

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="md"
      variant="primary"
      className="w-full"
      disabled={pending}
    >
      {pending ? "Verifying…" : "Verify"}
      {!pending && <ArrowRight className="h-4 w-4" />}
    </Button>
  );
}

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-xs text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent disabled:opacity-60 disabled:pointer-events-none"
    >
      {pending
        ? "Sending a fresh code…"
        : "Didn't get the email? Resend the code"}
    </button>
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
