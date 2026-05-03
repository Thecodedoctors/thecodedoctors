import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { OnboardForm } from "@/components/onboard-form";
import { Logo } from "@/components/logo";
import { ADMIN_HOME, APP_HOME } from "@/lib/portal-redirect";

export const metadata: Metadata = {
  title: "Start care",
  description:
    "Sign up for ongoing care from The Code Doctors.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  plan?: string;
  email?: string;
  url?: string;
  ref?: string;
}>;

const PLANS = {
  general: {
    label: "General Care",
    price: "$900",
    cadence: "per month",
    description:
      "Whatever fixes and edits your site needs, 24/7 monitoring, weekly health check, security patches — flat fee.",
    features: [
      "Same doctor every visit",
      "24/7 uptime + security monitoring",
      "Edits and fixes — whatever your site needs",
      "Direct messaging with your doctor",
      "Monthly report from your doctor",
    ],
  },
  premium: {
    label: "Premium Care",
    price: "$2,400",
    cadence: "per month",
    description:
      "Active treatment, priority response, dedicated security review, performance budget enforcement.",
    features: [
      "Everything in General Care",
      "Active improvements — we plan, you approve",
      "Priority same-day response",
      "Quarterly accessibility + security audits",
      "Performance budget enforcement on every change",
    ],
  },
} as const;

export default async function StartPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.role === "client" ? APP_HOME : ADMIN_HOME);
  }

  const params = await searchParams;
  const plan = (params.plan === "premium" ? "premium" : "general") as
    | "general"
    | "premium";
  const cfg = PLANS[plan];
  const otherPlan = plan === "general" ? "premium" : "general";
  const otherCfg = PLANS[otherPlan];

  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
      {/* Left — plan */}
      <div className="flex flex-col">
        <Link href="/" aria-label="The Code Doctors home" className="self-start">
          <Logo size={20} />
        </Link>

        <div className="mt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            {cfg.label}
          </p>
          <h1 className="mt-3 flex items-baseline gap-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            {cfg.price}
            <span className="text-base font-normal text-muted">
              {cfg.cadence}
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            {cfg.description}
          </p>
        </div>

        <ul className="mt-10 space-y-3">
          {cfg.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 text-sm text-muted"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <Link
          href={`/start?plan=${otherPlan}`}
          className="mt-10 inline-flex items-center gap-1.5 self-start rounded-full border border-border-strong px-4 py-1.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Switch to {otherCfg.label} ({otherCfg.price}/mo)
        </Link>

        <p className="mt-12 inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3 w-3" />
          We&apos;ll send a Stripe invoice link by email after sign-up.
          Stripe self-checkout arrives next release.
        </p>

        <p className="mt-3 text-xs text-muted">
          Already a patient?{" "}
          <Link
            href="/login"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Sign in
          </Link>
          . Want to try it first?{" "}
          <Link
            href="/trial"
            className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
          >
            Free 7-day trial
          </Link>
          .
        </p>
      </div>

      {/* Right — form */}
      <div className="flex items-center">
        <div className="w-full max-w-md rounded-2xl border border-border-strong bg-surface/60 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Start care
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Open your patient file.
          </h2>
          <p className="mt-2 text-sm text-muted">
            We&apos;ll have a doctor on it the same day.
          </p>

          <div className="mt-6">
            <OnboardForm
              variant="plan"
              plan={plan}
              defaultEmail={params.email}
              defaultUrl={params.url}
              refCode={params.ref}
            />
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            By signing up, you agree to our{" "}
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
