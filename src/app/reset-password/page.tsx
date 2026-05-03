import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ email?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { email } = await searchParams;

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

        <div className="rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Set a new password
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Paste your code.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter the 6-digit code we emailed you, plus the new password
            you&apos;d like to use.
          </p>

          <div className="mt-6">
            <ResetPasswordForm defaultEmail={email ?? ""} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Didn&apos;t get a code?{" "}
          <Link
            href="/forgot-password"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Send a new one
          </Link>
        </p>
      </div>
    </div>
  );
}
