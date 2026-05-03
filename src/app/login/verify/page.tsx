import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Check your inbox",
  robots: { index: false, follow: false },
};

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <Link href="/" aria-label="The Code Doctors home" className="mb-10 inline-block">
          <Logo size={20} />
        </Link>

        <div className="rounded-2xl border border-border-strong bg-surface/60 p-10">
          <span
            className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30"
            aria-hidden
          >
            <Mail className="h-5 w-5" />
          </span>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Check your inbox
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            We sent you a sign-in link.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Click the link in your email to finish signing in. The link expires
            in 10 minutes — if it&apos;s not in your inbox, check spam.
          </p>
        </div>

        <p className="mt-6 text-xs text-muted">
          Wrong email?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Go back
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
