"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/server/password-reset";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    startTransition(async () => {
      const res = await requestPasswordReset(fd);
      if (res.ok) {
        setSubmitted(email);
      } else {
        setError(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/5 p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <div>
            <p className="text-sm text-foreground">
              If we have an account for{" "}
              <span className="font-mono text-foreground">{submitted}</span>,
              a 6-digit code is on its way.
            </p>
            <p className="mt-2 text-xs text-muted">
              Check spam if it&apos;s not in your inbox in a minute. The code
              expires in 15 minutes.
            </p>
          </div>
        </div>

        <Button
          href={`/reset-password?email=${encodeURIComponent(submitted)}`}
          variant="primary"
          size="md"
          className="w-full"
        >
          Enter the code
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
        <Mail className="h-4 w-4 shrink-0 text-accent" />
        <input
          type="email"
          name="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@yourcompany.com"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
        />
      </label>

      <Button
        type="submit"
        size="md"
        variant="primary"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Sending…" : "Send reset code"}
        <ArrowRight className="h-4 w-4" />
      </Button>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-signal/30 bg-signal/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          <p className="text-xs text-foreground">{error}</p>
        </div>
      )}
      <p className="text-[11px] text-muted">
        We&apos;ll always show the same confirmation regardless of whether the
        email exists, so it can&apos;t be used to fish for accounts.{" "}
        <Link
          href="/login"
          className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          Back to sign-in
        </Link>
        .
      </p>
    </form>
  );
}
