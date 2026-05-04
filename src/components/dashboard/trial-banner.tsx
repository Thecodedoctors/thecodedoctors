import Link from "next/link";
import { Sparkles, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { endTrialNowForCurrentUser } from "@/server/billing";

/**
 * Trial countdown shown on the patient hub. Pure component — the page
 * computes `daysLeft` and `state` from `trialEndsAt` and passes both in
 * (keeps Date.now() out of render for react-hooks/purity).
 *
 * Renders nothing when state is "none" (no trial set).
 *
 * The active/expiring CTAs submit a server action that ends the trial
 * immediately on Stripe and charges the card on file. The expired CTA
 * routes to /billing where the patient can pick a new plan (since the
 * old subscription has typically been cancelled by then).
 */
export type TrialState = "none" | "active" | "expiring" | "expired";

export function computeTrialState(trialEndsAt: Date | null): {
  state: TrialState;
  daysLeft: number;
} {
  if (!trialEndsAt) return { state: "none", daysLeft: 0 };
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return { state: "expired", daysLeft: 0 };
  const daysLeft = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return {
    state: daysLeft <= 3 ? "expiring" : "active",
    daysLeft,
  };
}

export function TrialBanner({
  state,
  daysLeft,
  plan,
}: {
  state: TrialState;
  daysLeft: number;
  plan: string;
}) {
  if (state === "none") return null;

  const planLabel = plan === "premium" ? "Premium Care" : "General Care";

  if (state === "expired") {
    return (
      <section className="mt-6 rounded-2xl border border-signal/40 bg-signal/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-signal text-background">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-signal">
                Trial ended
              </p>
              <p className="mt-1 text-sm text-foreground">
                Pick a plan to keep your doctor on call. Your file and
                requests are saved either way.
              </p>
            </div>
          </div>
          <Link
            href="/billing"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
          >
            Pick a plan
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </section>
    );
  }

  if (state === "expiring") {
    return (
      <section className="mt-6 rounded-2xl border border-warning/40 bg-warning/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-warning/15 text-warning ring-1 ring-inset ring-warning/30">
              <Clock className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-warning">
                {daysLeft === 1 ? "1 day left" : `${daysLeft} days left`} in
                your trial
              </p>
              <p className="mt-1 text-sm text-foreground">
                Lock in continuous care now — same doctor, no interruption.
              </p>
            </div>
          </div>
          <form action={endTrialNowForCurrentUser}>
            <button
              type="submit"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background transition-colors hover:bg-[#e6e9ee]"
            >
              Convert to {planLabel}
              <ArrowRight className="h-3 w-3" />
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/30 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent ring-1 ring-inset ring-accent/30">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              Free trial · {daysLeft} days left
            </p>
            <p className="mt-1 text-sm text-foreground">
              You&apos;re on a {planLabel} trial. No card needed until you
              decide.
            </p>
          </div>
        </div>
        <form action={endTrialNowForCurrentUser}>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-4 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Convert early
            <ArrowRight className="h-3 w-3" />
          </button>
        </form>
      </div>
    </section>
  );
}
