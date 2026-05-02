import type { Metadata } from "next";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Settings,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getBillingStateForCurrentUser,
  startCheckoutForCurrentUser,
  openCustomerPortalForCurrentUser,
} from "@/server/billing";
import { Button } from "@/components/ui/button";
import { formatRelativeAgo } from "@/lib/time";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  checkout?: string;
  portal?: string;
}>;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const state = await getBillingStateForCurrentUser();
  const params = await searchParams;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-2xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Billing
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {state.hasSubscription ? "Your subscription" : "Choose a plan"}
          </h1>
        </div>

        {/* Banners */}
        {params.checkout === "success" && (
          <Banner
            tone="success"
            title="Payment received"
            body="Stripe confirmed your subscription. You're active — your doctor will be in touch."
          />
        )}
        {params.checkout === "canceled" && (
          <Banner
            tone="muted"
            title="Checkout canceled"
            body="No worries — pick a plan below when you're ready."
          />
        )}
        {params.portal === "no-customer" && (
          <Banner
            tone="muted"
            title="No payment method on file yet"
            body="Subscribe to a plan first; you'll be able to manage payment from here after."
          />
        )}

        {!state.configured ? (
          <NotConfiguredCard />
        ) : state.hasSubscription ? (
          <ActiveSubscriptionCard state={state} />
        ) : (
          <PickPlanCards state={state} />
        )}

        {/* What's included reference (always visible for clarity) */}
        <section className="mt-12">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
            What you get
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <PlanFeatureCard
              title="General Care"
              price="$900/mo"
              features={[
                "Two doctor-hours per week",
                "24/7 uptime + security monitoring",
                "Direct messaging with your doctor",
                "Quarterly checkup report",
              ]}
            />
            <PlanFeatureCard
              title="Premium Care"
              price="$2,400/mo"
              highlighted
              features={[
                "Five doctor-hours per week",
                "Priority same-day response",
                "Quarterly accessibility + security audits",
                "Performance budget enforcement on every change",
              ]}
            />
          </div>
        </section>
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function NotConfiguredCard() {
  return (
    <section className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
        Billing isn&apos;t wired up yet
      </p>
      <p className="mt-2 text-sm text-foreground">
        Stripe credentials aren&apos;t configured on this environment.
        Reach out and we&apos;ll set up your plan manually.
      </p>
    </section>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "success" | "muted";
  title: string;
  body: string;
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : "border-border bg-surface/40";
  const eyebrow = tone === "success" ? "text-success" : "text-muted";
  return (
    <section className={`mt-8 rounded-2xl border p-5 ${cls}`}>
      <p
        className={`font-mono text-[11px] uppercase tracking-[0.18em] ${eyebrow}`}
      >
        {title}
      </p>
      <p className="mt-2 text-sm text-foreground">{body}</p>
    </section>
  );
}

function ActiveSubscriptionCard({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const planLabel = state.plan === "premium" ? "Premium Care" : state.plan === "general" ? "General Care" : "Custom";
  const monthly = state.mrrCents > 0 ? `$${(state.mrrCents / 100).toFixed(0)}/mo` : "—";

  return (
    <section className="mt-8 rounded-2xl border border-border-strong bg-surface/40 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Active
          </p>
          <h2 className="mt-2 flex items-baseline gap-3 text-2xl font-semibold tracking-tight">
            {planLabel}
            <span className="text-base font-normal text-muted">{monthly}</span>
          </h2>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
          <CheckCircle2 className="h-5 w-5" />
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {state.cancelAtPeriodEnd ? "Access ends" : "Renews on"}
          </dt>
          <dd className="mt-1 text-foreground">
            {state.currentPeriodEnd
              ? state.currentPeriodEnd.toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Status
          </dt>
          <dd className="mt-1 text-foreground capitalize">
            {state.cancelAtPeriodEnd ? "Cancels at period end" : state.status}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <form action={openCustomerPortalForCurrentUser}>
          <Button type="submit" variant="primary" size="md">
            <Settings className="h-4 w-4" />
            Manage payment method
          </Button>
        </form>
        <p className="self-center text-xs text-muted">
          Update card, view invoices, change or cancel plan in Stripe.
        </p>
      </div>
    </section>
  );
}

function PickPlanCards({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const onTrial = state.trialPhase === "active" && state.trialEndsAt;
  const trialEnded = state.trialPhase === "ended";

  return (
    <>
      {onTrial && state.trialEndsAt && (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft/30 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Free trial · ends {formatRelativeAgo(state.trialEndsAt)}
              </p>
              <p className="mt-1 text-sm text-foreground">
                You&apos;re on a 14-day trial. Lock in continuous care
                below — no break in service.
              </p>
            </div>
          </div>
        </section>
      )}

      {trialEnded && (
        <section className="mt-8 rounded-2xl border border-signal/30 bg-signal/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-signal text-background">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                Your trial has ended
              </p>
              <p className="mt-1 text-sm text-foreground">
                Pick a plan to keep your doctor on call. Your file and
                requests are saved either way.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-3 md:grid-cols-2">
        <PlanCheckoutCard plan="general" label="General Care" price="$900" />
        <PlanCheckoutCard
          plan="premium"
          label="Premium Care"
          price="$2,400"
          highlighted
        />
      </section>
    </>
  );
}

function PlanCheckoutCard({
  plan,
  label,
  price,
  highlighted,
}: {
  plan: "general" | "premium";
  label: string;
  price: string;
  highlighted?: boolean;
}) {
  return (
    <form action={startCheckoutForCurrentUser}>
      <input type="hidden" name="plan" value={plan} />
      <button
        type="submit"
        className={`group flex w-full flex-col items-start gap-3 rounded-2xl border p-6 text-left transition-colors ${
          highlighted
            ? "border-accent bg-accent-soft/30 hover:bg-accent-soft/50"
            : "border-border bg-surface/40 hover:border-accent/50 hover:bg-surface/60"
        }`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">{label}</span>
          <span className="font-mono text-base text-muted">{price}/mo</span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-accent transition-transform group-hover:translate-x-0.5">
          Subscribe
          <ArrowRight className="h-3 w-3" />
        </span>
      </button>
    </form>
  );
}

function PlanFeatureCard({
  title,
  price,
  features,
  highlighted,
}: {
  title: string;
  price: string;
  features: string[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${highlighted ? "border-accent/30 bg-accent-soft/20" : "border-border bg-surface/40"}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
        {title}
      </p>
      <p className="mt-1 font-mono text-base text-foreground">{price}</p>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 leading-relaxed">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
