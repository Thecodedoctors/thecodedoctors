import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail, ArrowRight, Stethoscope } from "lucide-react";
import { signIn, auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { isDbConfigured } from "@/db";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Code Doctors portal.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  next?: string;
  error?: string;
  email?: string;
}>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const params = await searchParams;
  const next = params.next ?? "/dashboard";

  if (session?.user) {
    redirect(
      session.user.role && session.user.role !== "client" ? "/admin" : next
    );
  }

  const dbReady = isDbConfigured();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2.5 text-foreground"
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-md bg-surface text-accent ring-1 ring-border-strong"
            aria-hidden
          >
            <Stethoscope className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">The Code Doctors</span>
        </Link>

        <div className="rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Sign in
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-muted">
            We&apos;ll send you a one-time link. No passwords, no sign-up form.
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

          <form
            action={async (formData) => {
              "use server";
              const email = String(formData.get("email") ?? "").trim();
              if (!email) return;
              await signIn("resend", {
                email,
                redirectTo: next,
              });
            }}
            className="mt-6 space-y-3"
          >
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
            <Button
              type="submit"
              size="md"
              variant="primary"
              className="w-full"
            >
              Send sign-in link
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          {params.error && (
            <p className="mt-4 text-xs text-signal">
              We couldn&apos;t sign you in. Try again or reach out to{" "}
              <a
                href="mailto:hello@thecodedoctors.com"
                className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
              >
                hello@thecodedoctors.com
              </a>
              .
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
          </Link>{" "}
          and we&apos;ll set you up.
        </p>
      </div>
    </div>
  );
}
