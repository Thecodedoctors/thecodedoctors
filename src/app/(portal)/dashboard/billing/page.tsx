import type { Metadata } from "next";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Settings,
  Plus,
  Star,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import {
  getBillingStateForCurrentUser,
  startCheckoutForCurrentUser,
  upgradeSubscriptionForCurrentUser,
  openCustomerPortalForCurrentUser,
  listPaymentMethodsForCurrentUser,
  startAddCardCheckoutForCurrentUser,
  setDefaultPaymentMethodForCurrentUser,
  type SavedCard,
} from "@/server/billing";
import { Button } from "@/components/ui/button";
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
}>;

const PLAN_RANK: Record<string, number> = { general: 1, premium: 2 };

const PLAN_FEATURES: Record<
  "general" | "premium",
  { label: string; price: string; priceCents: number; features: string[] }
> = {
  general: {
    label: "General Care",
    price: "$900",
    priceCents: 90000,
    features: [
      "Two doctor-hours per week",
      "24/7 uptime + security monitoring",
      "Direct messaging with your doctor",
      "Quarterly checkup report",
    ],
  },
  premium: {
    label: "Premium Care",
    price: "$2,400",
    priceCents: 240000,
    features: [
      "Five doctor-hours per week",
      "Priority same-day response",
      "Quarterly accessibility + security audits",
      "Performance budget enforcement on every change",
    ],
  },
};

/** Features in `target` that aren't in `current` — what you actually
 *  *gain* by upgrading. Cheap string-equality is fine here; the lists
 *  are short and authored. */
function featureDelta(current: "general" | "premium", target: "general" | "premium"): string[] {
  const cur = new Set(PLAN_FEATURES[current].features);
  return PLAN_FEATURES[target].features.filter((f) => !cur.has(f));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [state, cards] = await Promise.all([
    getBillingStateForCurrentUser(),
    listPaymentMethodsForCurrentUser(),
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
  params: { checkout?: string; portal?: string; upgrade?: string; card?: string };
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
      {params.upgrade === "success" && (
        <Banner
          tone="success"
          title="Plan switched"
          body="Stripe will charge the prorated difference on your next invoice. Welcome to the new tier."
        />
      )}
      {params.upgrade === "not-higher" && (
        <Banner
          tone="warning"
          title="That isn't a higher tier"
          body="Use the Stripe portal below to downgrade — we don't surface that on-site."
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
          <dd className="mt-1 capitalize text-foreground">
            {state.cancelAtPeriodEnd ? "Cancels at period end" : state.status}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form action={openCustomerPortalForCurrentUser}>
          <Button type="submit" variant="secondary" size="sm">
            <Settings className="h-3.5 w-3.5" />
            Cancel or view invoices
          </Button>
        </form>
        <p className="text-xs text-muted">
          Cancel, downgrade, or grab past invoices on Stripe.
        </p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Plan ladder — current plan + higher tiers only
   ──────────────────────────────────────────────────────────────────────── */

function PlansLadder({
  state,
}: {
  state: Awaited<ReturnType<typeof getBillingStateForCurrentUser>>;
}) {
  const currentRank = PLAN_RANK[state.plan] ?? 0;
  const allTiers: ("general" | "premium")[] = ["general", "premium"];

  return (
    <section className="mt-12">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted">
        Plan
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {allTiers.map((tier) => {
          const tierRank = PLAN_RANK[tier];
          if (tierRank < currentRank) return null; // hide lower tiers
          const isCurrent = tierRank === currentRank;
          if (isCurrent) {
            return (
              <CurrentPlanCard
                key={tier}
                tier={tier}
                isOnlyTierAvailable={tierRank === 2}
              />
            );
          }
          return (
            <UpgradePlanCard
              key={tier}
              from={state.plan as "general" | "premium"}
              to={tier}
            />
          );
        })}
      </div>
    </section>
  );
}

function CurrentPlanCard({
  tier,
  isOnlyTierAvailable,
}: {
  tier: "general" | "premium";
  isOnlyTierAvailable: boolean;
}) {
  const meta = PLAN_FEATURES[tier];
  return (
    <div className="rounded-2xl border border-border bg-surface/30 p-6 opacity-70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Your plan
          </p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-muted-strong">
            {meta.label}
          </p>
          <p className="mt-1 font-mono text-sm text-muted">{meta.price}/mo</p>
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
      {isOnlyTierAvailable && (
        <p className="mt-5 rounded-md bg-surface/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Top tier — no further upgrade
        </p>
      )}
    </div>
  );
}

function UpgradePlanCard({
  from,
  to,
}: {
  from: "general" | "premium";
  to: "general" | "premium";
}) {
  const meta = PLAN_FEATURES[to];
  const newFeatures = featureDelta(from, to);
  return (
    <form action={upgradeSubscriptionForCurrentUser}>
      <input type="hidden" name="plan" value={to} />
      <button
        type="submit"
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
            <p className="mt-1 font-mono text-sm text-muted">{meta.price}/mo</p>
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
          Stripe will prorate — you won&apos;t pay a full second month.
        </span>
      </button>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   First-time pick (no subscription yet)
   ──────────────────────────────────────────────────────────────────────── */

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
            {meta.price}/mo
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
