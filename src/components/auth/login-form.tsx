"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAction, type LoginState } from "@/app/login/actions";

/**
 * Two-phase credentials login.
 *
 *   Phase 1  email + password
 *   Phase 2  (only for 2FA accounts) authenticator / recovery code —
 *            email + password are kept in component state and resent
 *            as hidden fields, so the user never retypes them and the
 *            page never reloads. This is the standard 2FA login feel.
 */
export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    loginAction,
    { phase: "credentials", error: initialError }
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  // Lets the user bail out of the code step back to the form without
  // waiting on a server round-trip.
  const [forceCredentials, setForceCredentials] = useState(false);

  const phase: LoginState["phase"] =
    forceCredentials ? "credentials" : state.phase;

  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (phase === "totp") codeRef.current?.focus();
  }, [phase]);

  return (
    <>
      <form action={formAction} className="mt-6 space-y-3">
        <input type="hidden" name="next" value={next} />

        {phase === "credentials" ? (
          <>
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
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
            </label>
            <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-border focus-within:ring-accent">
              <Lock className="h-4 w-4 shrink-0 text-accent" />
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
            </label>
          </>
        ) : (
          <>
            {/* email + password carried forward — no retype, no reload */}
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />

            <div className="rounded-xl border border-border bg-background/60 px-4 py-3 text-xs text-muted">
              Signing in as{" "}
              <span className="text-foreground">{email || "your account"}</span>
              .{" "}
              <button
                type="button"
                onClick={() => {
                  setForceCredentials(true);
                  setCode("");
                }}
                className="underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent"
              >
                Use a different account
              </button>
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-accent/60 focus-within:ring-accent">
              <KeyRound className="h-4 w-4 shrink-0 text-accent" />
              <input
                ref={codeRef}
                type="text"
                name="totpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}|[A-Za-z0-9-]{8,}"
                required
                placeholder="6-digit code from your authenticator"
                aria-label="Authenticator code or recovery code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-transparent font-mono tracking-widest text-foreground outline-none placeholder:text-muted placeholder:font-sans placeholder:tracking-normal text-sm"
              />
            </label>
          </>
        )}

        <Button
          type="submit"
          size="md"
          variant="primary"
          className="w-full"
          disabled={pending}
        >
          {pending
            ? "Checking…"
            : phase === "totp"
              ? "Verify code"
              : "Sign in"}
          {!pending && <ArrowRight className="h-4 w-4" />}
        </Button>

        {phase === "credentials" && (
          <p className="pt-1 text-center">
            <Link
              href="/forgot-password"
              className="text-xs text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent"
            >
              Forgot password?
            </Link>
          </p>
        )}
      </form>

      {state.error && (
        <p className="mt-4 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-xs text-signal">
          {errorCopy(state.error)}
        </p>
      )}
      {phase === "totp" && !state.error && (
        <p className="mt-4 rounded-lg border border-accent/30 bg-accent-soft/40 px-4 py-3 text-xs text-muted">
          Almost in — enter the 6-digit code from your authenticator app, or
          a recovery code if you&apos;ve lost your device.
        </p>
      )}
    </>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "Credentials":
    case "CredentialsSignin":
      return "Email or password is incorrect. Try again.";
    case "MissingEmail":
      return "Enter your email.";
    case "ShortPassword":
      return "Password must be at least 8 characters.";
    case "Suspended":
      return "This account is suspended. Reach out to hello@thecodedoctors.com if you think this is a mistake.";
    case "Deleted":
      return "This account has been closed. Reach out to hello@thecodedoctors.com if you need to reopen it.";
    case "RateLimited":
      return "Too many sign-in attempts. Wait 15 minutes and try again, or reset your password.";
    case "TotpInvalid":
      return "That code doesn't match. Try the next one your app shows, or use a recovery code.";
    default:
      return "We couldn't sign you in. Try again, or reach out to hello@thecodedoctors.com.";
  }
}
