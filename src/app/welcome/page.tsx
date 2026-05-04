import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { auth, signIn } from "@/auth";
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

// Always render dynamically — finalize hits the DB + Stripe and signs
// the user in; this MUST happen at request time.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ session_id?: string; error?: string }>;

/**
 * The Stripe Checkout success-url callback. Public — no auth required,
 * because the user has no account yet at this point.
 *
 * Flow:
 *   1. Read session_id query param.
 *   2. finalizePendingSignupBySessionId() — converts the pending_signup
 *      into real user/client/client_member rows. Also returns the
 *      decrypted auto-signin password (one-shot).
 *   3. If we have the password, call signIn() server-side — that
 *      throws NEXT_REDIRECT to /dashboard, the user lands logged in
 *      without ever retyping their password. Best UX.
 *   4. Fallback (rare): pending row was already consumed by the
 *      webhook — render the manual sign-in form.
 *
 * If finalize fails (token expired, payment unresolved): show a quiet
 * error and link to /login.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "client" ? APP_HOME : ADMIN_HOME);
  }

  const { session_id, error } = await searchParams;
  if (!session_id) {
    return <Failure message="No checkout session referenced. Try the trial again." />;
  }

  const result = await finalizePendingSignupBySessionId(session_id);
  if (!result.ok) {
    return <Failure message={result.error} />;
  }

  // Happy path: we have the plaintext password from the just-completed
  // signup → sign them in directly. signIn throws NEXT_REDIRECT on
  // success which Next propagates to the browser.
  //
  // Anything OTHER than NEXT_REDIRECT thrown from signIn (rate-limit
  // wedge, race with the just-inserted user, transient DB blip, Auth.js
  // CredentialsSignin) used to bubble all the way to the global
  // error.tsx and show the "Critical" page. We now catch those
  // explicitly and fall through to the manual sign-in form, which is a
  // graceful UX failure instead of a broken-looking one.
  if (result.autoSigninPassword) {
    try {
      await signIn("credentials", {
        email: result.email,
        password: result.autoSigninPassword,
        redirectTo: "/dashboard",
      });
      // Unreachable on success — signIn throws NEXT_REDIRECT.
    } catch (err) {
      // NEXT_REDIRECT must propagate so the redirect actually happens.
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        String((err as { digest?: unknown }).digest ?? "").startsWith(
          "NEXT_REDIRECT"
        )
      ) {
        throw err;
      }
      // Anything else — log it and fall through to the manual form.
      console.error("[welcome] auto-signin failed; falling back to manual", err);
    }
  }

  // Fallback: the webhook consumed the pending row before we got here,
  // AUTH_SECRET-based decryption failed, or auto-signin threw above.
  return (
    <ManualSignIn email={result.email} sessionId={session_id} error={error} />
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function ManualSignIn({
  email,
  sessionId,
  error,
}: {
  email: string;
  sessionId: string;
  error: string | undefined;
}) {
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
          Your account is set up and payment is confirmed. Sign in once to get
          to your hub — your doctor will be in touch shortly.
        </p>

        {error === "WrongPassword" && (
          <div className="mt-4 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-xs text-signal">
            That password didn&apos;t match. Try again, or use the full
            sign-in page below.
          </div>
        )}
        {error === "ShortPassword" && (
          <div className="mt-4 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-xs text-signal">
            Password must be at least 8 characters.
          </div>
        )}

        <form action={signInFromWelcome} className="mt-6 space-y-3 text-left">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="sessionId" value={sessionId} />
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
