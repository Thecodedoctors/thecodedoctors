import type { Metadata } from "next";
import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your Code Doctors password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
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
            Reset password
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Send me a code.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter your email and we&apos;ll send a 6-digit code to set a new
            password. Codes expire in 15 minutes.
          </p>

          <div className="mt-6">
            <ForgotPasswordForm />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Remembered it after all?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

void Mail;
void ArrowRight;
void Button;
