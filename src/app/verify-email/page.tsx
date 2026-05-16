import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { verifyEmailWithToken } from "@/lib/email-verification-core";
import { resolvePortalRedirect } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  token?: string;
}>;

/**
 * Email verification page. Two paths:
 *
 * 1. Magic link — /verify-email?token=<token>. Verified on the server
 *    (the token itself is the proof) → redirect to /dashboard, or show
 *    the error inline.
 * 2. Code entry — signed-in patient enters the 6-digit code. Handled
 *    by the client <VerifyEmailForm/> (in-place errors + resend, no
 *    reload); success redirects to /dashboard.
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
      <VerifyEmailForm email={session.user.email ?? "your email"} />

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
