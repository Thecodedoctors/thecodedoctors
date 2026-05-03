import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import {
  finalizePendingSignupBySessionId,
  signInFromWelcome,
} from "@/server/onboard-finalize";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ADMIN_HOME, APP_HOME } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ session_id?: string }>;

/**
 * The Stripe Checkout success-url callback. Public — no auth required,
 * because the user has no account yet at this point.
 *
 * What happens here:
 *   1. Read session_id query param.
 *   2. finalizePendingSignupBySessionId() — converts the pending_signup
 *      into real user/client/client_member rows, returns the user's
 *      email + stored password hash details.
 *   3. We can't directly auto-sign-in (we don't keep the plaintext
 *      password around), so we render a "Welcome — sign in to start"
 *      page with the email pre-filled. They sign in once and they're
 *      in. From then on, sign-in is normal.
 *
 * If finalize fails (token expired, payment unresolved): show a quiet
 * error and link to /login.
 */

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // If they're somehow already signed in, send them home.
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "client" ? APP_HOME : ADMIN_HOME);
  }

  const { session_id } = await searchParams;
  if (!session_id) {
    return <Failure message="No checkout session referenced. Try the trial again." />;
  }

  const result = await finalizePendingSignupBySessionId(session_id);
  if (!result.ok) {
    return <Failure message={result.error} />;
  }

  // Auto-sign-in: we have the password hash on the (now-deleted)
  // pending_signup row, but we never keep the plaintext password —
  // so we can't call signIn() directly. Instead, we fetch the
  // password from a one-shot read of the row's hash... actually no,
  // the row is deleted. The clean path: have finalize keep the
  // plaintext password in memory just long enough to sign in.
  //
  // Implementation: peek at finalize's session metadata for an
  // auto_login_password field — done by passing the raw password
  // through finalize. For now, surface a polished sign-in CTA.
  return <Success email={result.email} />;
}

/* ──────────────────────────────────────────────────────────────────────── */

function Success({ email }: { email: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="The Code Doctors home">
        <Logo size={20} />
      </Link>

      <div className="mt-12 w-full rounded-2xl border border-accent/30 bg-accent-soft/20 p-7 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          You&apos;re in
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Account created.
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          Your card is on file and your trial has started. Sign in once to
          get to your hub — your doctor will be in touch shortly.
        </p>

        {/* Sign-in form: pre-fills email, asks for the password they
            just chose during sign-up. After this they're signed in
            permanently and never see this page again.

            Action is a top-level export (signInFromWelcome) rather
            than an inline closure — Cloudflare Workers can't always
            reconstruct the closed-over `email` reliably. */}
        <form
          action={signInFromWelcome}
          className="mt-6 space-y-3 text-left"
        >
          <input type="hidden" name="email" value={email} />
          <p className="text-xs text-muted">
            Signing in as{" "}
            <span className="font-mono text-foreground">{email}</span>
          </p>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="Your password"
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-xl bg-background px-4 py-3 text-sm text-foreground outline-none ring-1 ring-inset ring-border focus:ring-accent"
          />
          <Button type="submit" size="md" variant="primary" className="w-full">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <p className="mt-4 text-[11px] text-muted">
          Different email or wrong password?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Use the full sign-in page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Failure({ message }: { message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="The Code Doctors home">
        <Logo size={20} />
      </Link>

      <div className="mt-12 w-full rounded-2xl border border-signal/30 bg-signal/5 p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-signal text-background">
          <AlertCircle className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Couldn&apos;t finish your sign-up
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">{message}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button href="/trial" variant="primary" size="md">
            Restart the trial
          </Button>
          <Button href="/login" variant="secondary" size="md">
            Already a patient? Sign in
          </Button>
        </div>

        <p className="mt-4 text-[11px] text-muted">
          Stuck? Email{" "}
          <a
            href="mailto:hello@thecodedoctors.com"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            hello@thecodedoctors.com
          </a>{" "}
          — we&apos;ll sort it out.
        </p>
      </div>
    </div>
  );
}

