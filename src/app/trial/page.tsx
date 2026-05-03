import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Activity, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { OnboardForm } from "@/components/onboard-form";
import { Logo } from "@/components/logo";
import { ADMIN_HOME, APP_HOME } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Start your free trial",
  description:
    "7 days of General Care, free. We diagnose, prescribe, and treat — you keep your business running.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ email?: string; url?: string; ref?: string }>;

export default async function TrialPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // If they're already signed in, send them home.
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "client" ? APP_HOME : ADMIN_HOME);
  }

  const { email, url, ref } = await searchParams;

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
      {/* Left — pitch */}
      <div className="flex flex-col">
        <Link href="/" aria-label="The Code Doctors home" className="self-start">
          <Logo size={20} />
        </Link>

        <div className="mt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            7-day free trial
          </p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Let&apos;s get your site healthy.
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            Two weeks of General Care on us. We diagnose what your scan
            flagged, prescribe a treatment plan, and start work the same
            day. Cancel anytime in those 7 days — no charge.
          </p>
        </div>

        <ul className="mt-10 space-y-5">
          <Bullet icon={ShieldCheck}>
            <strong className="text-foreground">Same doctor, every visit.</strong>{" "}
            One assigned doctor learns your stack so context never resets.
          </Bullet>
          <Bullet icon={Activity}>
            <strong className="text-foreground">24/7 site monitoring</strong>{" "}
            with proactive alerts when something looks off.
          </Bullet>
          <Bullet icon={MessageCircle}>
            <strong className="text-foreground">Direct line to your doctor</strong>{" "}
            — submit requests, see status, message back and forth.
          </Bullet>
        </ul>

        <p className="mt-12 text-xs text-muted">
          Already a patient?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Sign in
          </Link>
          .
        </p>
      </div>

      {/* Right — form */}
      <div className="flex items-center">
        <div className="w-full max-w-md rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Start the trial
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Set up your patient file.
          </h2>
          <p className="mt-2 text-sm text-muted">
            Five fields, then we&apos;ll take you to Stripe to add a card.
            Nothing charged until day 8. Cancel anytime in between.
          </p>

          <div className="mt-6">
            <OnboardForm
              variant="trial"
              defaultEmail={email}
              defaultUrl={url}
              refCode={ref}
            />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            By starting your trial, you agree to our{" "}
            <Link
              href="/terms"
              className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline decoration-border-strong underline-offset-4 hover:decoration-accent"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Bullet({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-sm text-muted">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-accent ring-1 ring-inset ring-accent/20">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
