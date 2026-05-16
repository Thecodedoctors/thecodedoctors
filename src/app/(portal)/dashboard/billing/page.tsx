import type { Metadata } from "next";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Plus,
  Star,
  Download,
  FileText,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getBillingStateForCurrentUser,
  startCheckoutForCurrentUser,
  upgradeSubscriptionForCurrentUser,
  listPaymentMethodsForCurrentUser,
  listInvoicesForCurrentUser,
  startAddCardCheckoutForCurrentUser,
  setDefaultPaymentMethodForCurrentUser,
  type SavedCard,
  type ClientInvoice,
} from "@/server/billing";
import { UpgradeSubmitButton } from "@/components/billing/upgrade-submit-button";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{
  checkout?: string;
  portal?: string;
  upgrade?: string;
  card?: string;
  trial?: string;
}>;

const PLAN_RANK: Record<string, number> = {
  checkup: 0,
  general: 1,
  premium: 2,
};

const YEARLY_DISCOUNT = 0.15;

const PLAN_FEATURES: Record<
  "general" | "premium",
  {
    label: string;
    monthlyPrice: number;
    yearlyMonthlyEquivalent: number;
    features: string[];
  }
> = {
  general: {
    label: "General Care",
    monthlyPrice: 299,
    yearlyMonthlyEquivalent: monthlyEquivalentYearly(299),
    features: [
      "Monthly design + content improvements",
      "Monthly SEO work — keywords, schema, search-engine health",
      "Industry-standard security hardening + WAF",
      "Edits and fixes — whatever your site needs",
      "Plugin & dependency updates with rollback safety",
      "Form spam + bot protection",
      "Image + asset optimization for speed",
      "24/7 uptime monitoring + automatic backups",
      "Direct messaging with your doctor",
      "Monthly report from your doctor",
      "And more",
    ],
  },
  premium: {
    label: "Premium Care",
    monthlyPrice: 899,
    yearlyMonthlyEquivalent: monthlyEquivalentYearly(899),
    features: [
      "Everything in General Care, plus:",
      "Same-day priority response, 7 days a week + emergency line",
      "Top-tier security: WAF tuning, SPF/DKIM/DMARC, header lockdown",
      "Email breach monitoring (HIBP) — alerts within the hour",
      "Live security + uptime telemetry on your dashboard",
      "Quarterly accessibility + security audit",
      "A/B testing + monthly conversion experiments",
      "Staging environment + safe deploy workflow",
      "Quarterly strategy + roadmap session",
      "Custom builds — mobile apps, integrations, bespoke features (priced separately)",
      "And more",
    ],
  },
};

function monthlyEquivalentYearly(monthly: number): number {
  return Math.round((monthly * 12 * (1 - YEARLY_DISCOUNT)) / 12);
}

function yearlyTotal(monthly: number): number {
  return Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
}

/** Features in `target` that aren't in `current` — what you actually
 *  *gain* by upgrading. Cheap string-equality is fine here; the lists
 *  are short and authored. */
function featureDelta(
  current: "general" | "premium",
  target: "general" | "premium"
): string[] {
  const cur = new Set(PLAN_FEATURES[current].features);
  return PLAN_FEATURES[target].features.filter((f) => !cur.has(f));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [state, cards, invoices] = await Promise.all([
    getBillingStateForCurrentUser(),
    listPaymentMethodsForCurrentUser(),
    listInvoicesForCurrentUser(),
  ]);
  const params = await searchParams;

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
            Billing
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {state.hasSubscription ? "Your subscription" : "Choose a plan"}
          </h1>
        </div>

        <Banners params={params} />

        {!state.configured ? (
          <NotConfiguredCard />
        ) : state.hasSubscription ? (
          <>
            <ActiveSubscriptionCard state={state} />
            <PlansLadder state={state} />
          </>
        ) : (
          <PickPlanCards state={state} />
        )}

        {state.configured && <PaymentMethodsSection cards={cards} />}
        {state.configured && state.hasSubscription && (
          <InvoicesSection invoices={invoices} />
        )}
      </div>
    </Section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Banners
   ──────────────────────────────────────────────────────────────────────── */

function Banners({
  params,
}: {
  params: {
    checkout?: string;
    portal?: string;
    upgrade?: string;
    card?: string;
    trial?: string;
  };
}) {
  return (
    <>
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
          body="No worries — pick a plan when you're ready."
        />
      )}
      {params.checkout === "already-subscribed" && (
        <Banner
          tone="warning"
          title="You're already subscribed"
          body="Use the upgrade buttons below to switch tiers — we won't bill you twice."
        />
      )}
      {params.checkout === "failed" && (
        <Banner
          tone="warning"
          title="Checkout couldn't start"
          body="We couldn't reach our payment processor just now. No charge was made — please try again in a moment."
        />
      )}
      {params.upgrade === "success" && (
        <Banner
          tone="success"
          title="Plan switched"
          body="The prorated upgrade amount was charged to your card on file. Welcome to the new tier."
        />
      )}
      {params.upgrade === "not-higher" && (
        <Banner
          tone="warning"
          title="That isn't a change"
          body="Use the Stripe portal below to downgrade — we don't surface that on-site."
        />
      )}
      {params.upgrade === "failed" && (
        <Banner
          tone="warning"
          title="We couldn't switch your plan"
          body="Stripe rejected the change. Your existing plan is unaffected. Email hello@thecodedoctors.com and we'll sort it out."
        />
      )}
      {params.trial === "converted" && (
        <Banner
          tone="success"
          title="You're a paying patient now"
          body="Trial ended early — Stripe charged your card on file for the first billing period. Welcome to ongoing care."
        />
      )}
      {params.trial === "no-subscription" && (
        <Banner
          tone="muted"
          title="No subscription on file"
          body="Pick a plan first to start care."
        />
      )}
      {params.trial === "already-ended" && (
        <Banner
          tone="muted"
          title="Trial already ended"
          body="Looks like billing has already started — refresh to see your subscription state."
        />
      )}
      {params.trial === "failed" && (
        <Banner
          tone="warning"
          title="We couldn't end your trial early"
          body="Stripe rejected the change. Your trial keeps running. Email hello@thecodedoctors.com and we'll sort it out."
        />
      )}
      {params.upgrade === "no-subscription" && (
        <Banner
          tone="muted"
          title="No subscription to upgrade"
          body="Pick a plan first."
        />
      )}
      {params.card === "added" && (
        <Banner
          tone="success"
          title="Card saved"
          body="Your new card is on file. Set it as default below if you want future invoices charged to it."
        />
      )}
      {params.card === "canceled" && (
        <Banner tone="muted" title="Add card canceled" body="Nothing changed." />
      )}
      {params.card === "failed" && (
        <Banner
          tone="warning"
          title="Couldn't start card setup"
          body="We couldn't reach our payment processor just now. Nothing changed — please try again in a moment."
        />
      )}
      {params.card === "default-set" && (
        <Banner
          tone="success"
          title="Default card updated"
          body="Future invoices will charge this card."
        />
      )}
      {params.card === "forbidden" && (
        <Banner
          tone="warning"
          title="That card isn't on this account"
          body="If you think this is a mistake, reach out."
        />
      )}
      {params.portal === "no-customer" && (
        <Banner
          tone="muted"
          title="No payment method on file yet"
          body="Subscribe first; you'll be able to manage payment from here after."
        />
      )}
    </>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "success" | "muted" | "warning";
  title: string;
  body: string;
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : "border-border bg-surface/40";
  const eyebrow =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-muted";
  return (
    <section className={cn("mt-8 rounded-2xl border p-5", cls)}>
      <p className={cn("font-mono text-[11px] uppercase tracking-[0.18em]", eyebrow)}>
        {title}
      </p>
      <p className="mt-2 text-sm text-foreground">{body}</p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Stripe-not-configured fallback
   ──────────────────────────────────────────────────────────────────────── */

function NotConfiguredCard() {
  return (
    <section className="mt-8 rounded-2xl border border-warning/30 bg-warning/5 p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
        Billing isn&apos;t wired up yet
      </p>
      <p className="mt-2 text-sm text-foreground">
        Stripe credentials aren&apos;t configured on this environment. Reach
        out and we&apos;ll set up your plan manually.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Active subscription summary
   ──────────────────────────────────────────────────────────────────────── */

function ActiveSubscriptionCard({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const planLabel =
    state.plan === "premium"
      ? "Premium Care"
      : state.plan === "general"
        ? "General Care"
        : "Custom";
  const monthly =
    state.mrrCents > 0 ? `$${(state.mrrCents / 100).toFixed(0)}/mo` : "—";
  const intervalLabel =
    state.interval === "yearly" ? "Billed yearly" : "Billed monthly";

  return (
    <section className="mt-8 rounded-2xl border border-border-strong bg-surface/40 p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            Active · {intervalLabel}
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
          <dd className="mt-1 capitalize text-foreground">
            {state.cancelAtPeriodEnd ? "Cancels at period end" : state.status}
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-xs text-muted">
        Want to cancel?{" "}
        <a
          href="mailto:hello@thecodedoctors.com?subject=Cancel%20my%20plan"
          className="text-foreground underline decoration-border-strong underline-offset-4 hover:decoration-accent"
        >
          Email us
        </a>{" "}
        and we&apos;ll take care of it. Past invoices are listed below.
      </p>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Plan ladder — current plan + higher tiers + cadence-switch upsell
   ──────────────────────────────────────────────────────────────────────── */

function PlansLadder({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const currentPlan = state.plan as "general" | "premium";
  const currentRank = PLAN_RANK[state.plan] ?? 0;
  const currentInterval = state.interval ?? "monthly";

  const allTiers: ("general" | "premium")[] = ["general", "premium"];

  return (
    <section className="mt-12">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        Plan
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {allTiers.map((tier) => {
          const tierRank = PLAN_RANK[tier];
          if (tierRank < currentRank) return null;
          const isCurrent = tierRank === currentRank;
          if (isCurrent) {
            return (
              <CurrentPlanCard
                key={tier}
                tier={tier}
                interval={currentInterval}
                showYearlySwitch={currentInterval === "monthly"}
              />
            );
          }
          return (
            <UpgradePlanCard
              key={tier}
              from={currentPlan}
              to={tier}
              interval={currentInterval}
            />
          );
        })}
      </div>
    </section>
  );
}

function CurrentPlanCard({
  tier,
  interval,
  showYearlySwitch,
}: {
  tier: "general" | "premium";
  interval: "monthly" | "yearly";
  showYearlySwitch: boolean;
}) {
  const meta = PLAN_FEATURES[tier];
  const priceLabel =
    interval === "yearly"
      ? `$${meta.yearlyMonthlyEquivalent}/mo · billed yearly`
      : `$${meta.monthlyPrice}/mo`;

  // The "your plan" info is rendered at reduced opacity to signal it's
  // the current state (informational, not actionable). The yearly-switch
  // CTA below it is fully active — it must NOT inherit the opacity, so
  // it lives outside the dimmed wrapper as a sibling.
  return (
    <div className="rounded-2xl border border-border bg-surface/30 p-6">
      <div className="opacity-70">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Your plan
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-muted-strong">
              {meta.label}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">{priceLabel}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted/10 text-muted ring-1 ring-inset ring-muted/20">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        </div>
        <ul className="mt-5 space-y-2 text-sm text-muted">
          {meta.features.map((f) => (
            <li key={f} className="flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
      {showYearlySwitch && (
        <form action={upgradeSubscriptionForCurrentUser} className="mt-5">
          <input type="hidden" name="plan" value={tier} />
          <input type="hidden" name="interval" value="yearly" />
          <UpgradeSubmitButton
            pendingLabel="Switching to yearly…"
            className="group block w-full rounded-xl border border-accent/50 bg-accent-soft/30 px-4 py-3 text-left transition-colors hover:border-accent hover:bg-accent-soft/50"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Switch to yearly · save 15%
            </p>
            <p className="mt-1 text-xs text-foreground">
              ${yearlyTotal(meta.monthlyPrice).toLocaleString()}/yr instead of $
              {(meta.monthlyPrice * 12).toLocaleString()}/yr.
            </p>
          </UpgradeSubmitButton>
        </form>
      )}
    </div>
  );
}

function UpgradePlanCard({
  from,
  to,
  interval,
}: {
  from: "general" | "premium";
  to: "general" | "premium";
  interval: "monthly" | "yearly";
}) {
  const meta = PLAN_FEATURES[to];
  const newFeatures = featureDelta(from, to);
  const priceLabel =
    interval === "yearly"
      ? `$${meta.yearlyMonthlyEquivalent}/mo · billed yearly`
      : `$${meta.monthlyPrice}/mo`;
  return (
    <form action={upgradeSubscriptionForCurrentUser}>
      <input type="hidden" name="plan" value={to} />
      <input type="hidden" name="interval" value={interval} />
      <UpgradeSubmitButton
        pendingLabel="Upgrading…"
        className="group flex w-full flex-col items-start gap-3 rounded-2xl border border-accent bg-accent-soft/20 p-6 text-left transition-colors hover:bg-accent-soft/40"
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              Upgrade
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {meta.label}
            </p>
            <p className="mt-1 font-mono text-sm text-muted">{priceLabel}</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {newFeatures.length > 0 && (
          <div className="w-full rounded-xl border border-accent/20 bg-background/40 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              Plus, on top of {PLAN_FEATURES[from].label}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-foreground">
              {newFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 leading-relaxed">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <span className="font-mono text-xs text-accent">
          Charged immediately, prorated for the time remaining on your current plan.
        </span>
      </UpgradeSubmitButton>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   First-time pick (no subscription yet) — Checkup-only or trial
   ──────────────────────────────────────────────────────────────────────── */

function PickPlanCards({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const onTrial = state.trialPhase === "active" && state.trialEndsAt;
  const trialEnded = state.trialPhase === "ended";
  const checkupOnly = state.plan === "checkup";

  return (
    <>
      {checkupOnly && (
        <section className="mt-8 rounded-2xl border border-accent/30 bg-accent-soft/30 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                Checkup complete · ready for ongoing care
              </p>
              <p className="mt-1 text-sm text-foreground">
                Your $599 Checkup credits toward your first 2 months — pick a
                plan below to keep your doctor on call.
              </p>
            </div>
          </div>
        </section>
      )}

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
                You&apos;re on a 7-day trial. Lock in continuous care below — no
                break in service.
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
                Pick a plan to keep your doctor on call. Your file and requests
                are saved either way.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-3 md:grid-cols-2">
        <PlanCheckoutCard plan="general" />
        <PlanCheckoutCard plan="premium" highlighted />
      </section>
      <p className="mt-4 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        Want yearly billing? Pick your plan, then switch to yearly from the
        dashboard. 15% off.
      </p>
    </>
  );
}

function PlanCheckoutCard({
  plan,
  highlighted,
}: {
  plan: "general" | "premium";
  highlighted?: boolean;
}) {
  const meta = PLAN_FEATURES[plan];
  return (
    <form action={startCheckoutForCurrentUser}>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="interval" value="monthly" />
      <button
        type="submit"
        className={cn(
          "group flex w-full flex-col items-start gap-3 rounded-2xl border p-6 text-left transition-colors",
          highlighted
            ? "border-accent bg-accent-soft/30 hover:bg-accent-soft/50"
            : "border-border bg-surface/40 hover:border-accent/50 hover:bg-surface/60"
        )}
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
          <CreditCard className="h-4 w-4" />
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tracking-tight">
            {meta.label}
          </span>
          <span className="font-mono text-base text-muted">
            ${meta.monthlyPrice}/mo
          </span>
        </div>
        <ul className="mt-1 space-y-1.5 text-xs text-muted">
          {meta.features.slice(0, 3).map((f) => (
            <li key={f} className="flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-accent transition-transform group-hover:translate-x-0.5">
          Subscribe
          <ArrowRight className="h-3 w-3" />
        </span>
      </button>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Payment methods
   ──────────────────────────────────────────────────────────────────────── */

function PaymentMethodsSection({ cards }: { cards: SavedCard[] }) {
  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Payment methods
        </h2>
        <form action={startAddCardCheckoutForCurrentUser}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            <Plus className="h-3 w-3" />
            Add card
          </button>
        </form>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
            <CreditCard className="h-4 w-4" />
          </span>
          <p className="mt-4 text-sm text-foreground">No cards on file yet.</p>
          <p className="mt-1 text-xs text-muted">
            Add one to keep your subscription active when the next invoice
            cycles.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface text-muted ring-1 ring-inset ring-border">
                <CreditCard className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {brandLabel(card.brand)} •••• {card.last4}
                </p>
                <p className="font-mono text-xs text-muted">
                  exp {String(card.expMonth).padStart(2, "0")}/
                  {String(card.expYear).slice(-2)}
                </p>
              </div>
              {card.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent ring-1 ring-inset ring-accent/30">
                  <Star className="h-2.5 w-2.5 fill-accent" />
                  Default
                </span>
              ) : (
                <form action={setDefaultPaymentMethodForCurrentUser}>
                  <input
                    type="hidden"
                    name="paymentMethodId"
                    value={card.id}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-border-strong px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    Set default
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function brandLabel(brand: string): string {
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex",
    discover: "Discover",
    diners: "Diners",
    jcb: "JCB",
    unionpay: "UnionPay",
  };
  return map[brand] ?? brand[0]?.toUpperCase() + brand.slice(1);
}

/* ──────────────────────────────────────────────────────────────────────────
   Invoices — rendered in-app instead of redirecting to Stripe Customer Portal.
   PDF downloads still come from Stripe's CDN (they generate the PDFs);
   everything else lives in our UI.
   ──────────────────────────────────────────────────────────────────────── */

function InvoicesSection({ invoices }: { invoices: ClientInvoice[] }) {
  return (
    <section className="mt-12">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        Invoices
      </h2>
      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/30 p-8 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
            <FileText className="h-4 w-4" />
          </span>
          <p className="mt-4 text-sm text-foreground">No invoices yet.</p>
          <p className="mt-1 text-xs text-muted">
            Your first invoice will land here after the next billing cycle.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {invoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface text-muted ring-1 ring-inset ring-border">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {inv.number}
                  </span>
                  <InvoiceStatusBadge status={inv.status} />
                </p>
                <p className="mt-1 text-xs text-muted">
                  {inv.date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {inv.summary && <> · {inv.summary}</>}
                </p>
              </div>
              <p className="font-mono text-sm font-medium text-foreground tabular-nums">
                {formatMoney(inv.amount, inv.currency)}
              </p>
              {inv.pdfUrl ? (
                <a
                  href={inv.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Download className="h-3 w-3" />
                  PDF
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InvoiceStatusBadge({ status }: { status: ClientInvoice["status"] }) {
  const variants: Record<
    ClientInvoice["status"],
    { label: string; cls: string }
  > = {
    paid: {
      label: "Paid",
      cls: "bg-success/10 text-success ring-success/30",
    },
    open: {
      label: "Open",
      cls: "bg-accent-soft text-accent ring-accent/30",
    },
    void: {
      label: "Void",
      cls: "bg-muted/10 text-muted ring-muted/20",
    },
    uncollectible: {
      label: "Uncollectible",
      cls: "bg-warning/10 text-warning ring-warning/30",
    },
    draft: {
      label: "Draft",
      cls: "bg-muted/10 text-muted ring-muted/20",
    },
  };
  const v = variants[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ring-1 ring-inset",
        v.cls
      )}
    >
      {v.label}
    </span>
  );
}

function formatMoney(amountCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `$${(amountCents / 100).toFixed(2)}`;
  }
}
