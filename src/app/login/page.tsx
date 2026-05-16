import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, Lock, ArrowRight, KeyRound } from "lucide-react";
import { AuthError } from "next-auth";
import { sql } from "drizzle-orm";
import { signIn, auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { db, users, isDbConfigured } from "@/db";
import { resolvePortalRedirect } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Code Doctors portal.",
  robots: { index: false, follow: false },
};

/**
 * Sanitize the post-login `next` target. Open-redirect guard: only a
 * same-origin absolute path is allowed. Rejects protocol-relative
 * (`//evil.com`), backslash tricks (`/\evil.com`), scheme URLs
 * (these never start with `/`), and CRLF/control chars. Anything
 * suspicious falls back to the dashboard.
 */
function sanitizeNext(raw: unknown): string {
  const fallback = "/dashboard";
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  if (raw[0] !== "/") return fallback;
  if (raw[1] === "/" || raw[1] === "\\") return fallback;
  if (Array.from(raw).some((ch) => {
    const c = ch.charCodeAt(0);
    return c < 0x20 || c === 0x7f;
  })) {
    return fallback;
  }
  return raw;
}

/**
 * Top-level Server Action — must NOT close over outer scope.
 * Cloudflare Workers can fail to reconstruct closures, surfacing as a 404
 * "Server action not found" when the form is submitted. Reads `next` from
 * a hidden form field instead of capturing it from the page render.
 */
async function loginAction(formData: FormData): Promise<void> {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const totpCode = String(formData.get("totpCode") ?? "").trim();
  const next = sanitizeNext(formData.get("next"));

  const back = (err: string, opts: { keepEmail?: boolean } = {}) =>
    redirect(
      `/login?error=${err}&email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}${
        opts.keepEmail === false ? "" : ""
      }`
    );

  if (!email) back("MissingEmail");
  if (password.length < 8) back("ShortPassword");

  // Rate limiting moved into `authorize()` in `src/auth.ts` so it
  // covers BOTH this form action AND direct hits to
  // /api/auth/callback/credentials (which an attacker would target).
  // The login form here just relays the error code via Auth.js.

  // Pre-check suspended / deleted state so the user gets accurate copy
  // instead of a generic "wrong password." Trade-off: this leaks
  // existence + state for that email — acceptable here because we're
  // not in an enumeration-sensitive context.
  if (isDbConfigured()) {
    try {
      const rows = await db()
        .select({
          suspendedAt: users.suspendedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      const u = rows[0];
      if (u?.deletedAt) back("Deleted");
      if (u?.suspendedAt) back("Suspended");
    } catch {
      /* fall through */
    }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      totpCode,
      redirectTo: next,
    });
  } catch (err) {
    // Auth.js uses NEXT_REDIRECT on success; let that propagate.
    if (err instanceof AuthError) {
      const code =
        // Custom CredentialsSignin subclasses set their own .code which
        // bubbles up via err.cause.err.code in some Auth.js versions.
        // Cover both the direct property and the cause path.
        (err as { code?: string }).code ??
        ((err as { cause?: { err?: { code?: string } } }).cause?.err?.code ?? "");
      if (code === "TotpRequired") back("TotpRequired");
      if (code === "TotpInvalid") back("TotpInvalid");
      if (code === "RateLimited") back("RateLimited");
      back("Credentials");
    }
    throw err;
  }
}

type SearchParams = Promise<{
  next?: string;
  error?: string;
  email?: string;
  reset?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const next = sanitizeNext(params.next);

  if (session?.user) {
    const target =
      session.user.role && session.user.role !== "client" ? "/admin" : next;
    redirect(resolvePortalRedirect(target));
  }

  const dbReady = isDbConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="The Code Doctors home" className="mb-10 inline-block">
          <Logo size={20} />
        </Link>

        <div className="rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Sign in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-muted">
            For existing patients only.
          </p>

          {!dbReady && (
            <div className="mt-6 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
              <p className="font-medium">Database not configured</p>
              <p className="mt-1 text-xs text-muted">
                Set <code className="font-mono">DATABASE_URL</code> in <code className="font-mono">.env.local</code> first
                — Auth.js stores sessions in Postgres. Neon&apos;s free tier
                works.
              </p>
            </div>
          )}

          <form action={loginAction} className="mt-6 space-y-3">
            <input type="hidden" name="next" value={next} />
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
                defaultValue={params.email ?? ""}
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
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
            </label>

            {/* TOTP code — hidden until the server tells us we need it.
                Once the user has 2FA on, the first submit fails with
                error=TotpRequired; we re-render with this field visible
                and pre-focused. */}
            {(params.error === "TotpRequired" ||
              params.error === "TotpInvalid") && (
              <label className="flex items-center gap-3 rounded-xl bg-background px-4 py-3 ring-1 ring-inset ring-accent/60 focus-within:ring-accent">
                <KeyRound className="h-4 w-4 shrink-0 text-accent" />
                <input
                  type="text"
                  name="totpCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}|[A-Za-z0-9-]{8,}"
                  required
                  autoFocus
                  placeholder="6-digit code from your authenticator"
                  aria-label="Authenticator code or recovery code"
                  className="w-full bg-transparent font-mono tracking-widest text-foreground outline-none placeholder:text-muted placeholder:font-sans placeholder:tracking-normal text-sm"
                />
              </label>
            )}

            <Button
              type="submit"
              size="md"
              variant="primary"
              className="w-full"
            >
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="pt-1 text-center">
              <Link
                href="/forgot-password"
                className="text-xs text-muted underline decoration-border-strong underline-offset-4 hover:text-foreground hover:decoration-accent"
              >
                Forgot password?
              </Link>
            </p>
          </form>

          {params.reset === "1" && (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-xs text-success">
              Password updated. Sign in with your new password.
            </p>
          )}
          {params.error && (
            <p className="mt-4 rounded-lg border border-signal/30 bg-signal/5 px-4 py-3 text-xs text-signal">
              {errorCopy(params.error)}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Not a patient yet?{" "}
          <Link
            href="/checkup"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Run a free checkup
          </Link>
          , then start a free trial — or{" "}
          <Link
            href="/plans"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            pick a plan
          </Link>
          .
        </p>
      </div>
    </div>
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
    case "TotpRequired":
      return "Almost in — enter the 6-digit code from your authenticator app, or a recovery code if you've lost your device.";
    case "TotpInvalid":
      return "That code doesn't match. Try the next one your app shows, or use a recovery code.";
    default:
      return "We couldn't sign you in. Try again, or reach out to hello@thecodedoctors.com.";
  }
}
