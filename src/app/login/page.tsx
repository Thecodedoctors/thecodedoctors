import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/auth/login-form";
import { isDbConfigured } from "@/db";
import { resolvePortalRedirect } from "@/lib/portal-redirect";
import { sanitizeNext } from "@/lib/safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Code Doctors portal.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  next?: string;
  error?: string;
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

          {params.reset === "1" && (
            <p className="mt-4 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-xs text-success">
              Password updated. Sign in with your new password.
            </p>
          )}

          <LoginForm next={next} initialError={params.error} />
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
