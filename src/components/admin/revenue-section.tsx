import { TrendingUp, Users } from "lucide-react";
import { revenueForFounder } from "@/server/revenue";

/**
 * Founder-only revenue rollup. Renders nothing for any non-founder role
 * because the server function returns null in that case. Safe to drop
 * into the admin home unconditionally.
 */
export async function RevenueSection() {
  const data = await revenueForFounder();
  if (!data) return null;

  return (
    <section className="mt-12">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Revenue · founder view
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          From mrr_cents · live
        </span>
      </div>

      <div className="rounded-2xl border border-border bg-surface/40 p-7">
        <div className="grid gap-6 sm:grid-cols-3">
          <Hero
            label="MRR"
            value={formatMoney(data.mrrCents)}
            sub={`${data.activeClients} active patient${data.activeClients === 1 ? "" : "s"}`}
            icon={TrendingUp}
          />
          <Hero
            label="ARR"
            value={formatMoney(data.arrCents)}
            sub="Annualised at current MRR"
            icon={TrendingUp}
          />
          <Hero
            label="ARPU"
            value={
              data.activeClients > 0
                ? formatMoney(Math.round(data.mrrCents / data.activeClients))
                : "—"
            }
            sub="Per active patient · monthly"
            icon={Users}
          />
        </div>

        {data.byPlan.length > 0 && (
          <div className="mt-7 border-t border-border pt-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Plan mix
            </p>
            <ul className="mt-3 space-y-2">
              {data.byPlan
                .filter((p) => p.count > 0)
                .sort((a, b) => b.mrrCents - a.mrrCents)
                .map((p) => {
                  const pct =
                    data.mrrCents > 0
                      ? Math.round((p.mrrCents / data.mrrCents) * 100)
                      : 0;
                  return (
                    <li key={p.plan} className="flex items-center gap-3">
                      <span className="w-32 text-sm text-foreground">
                        {planLabel(p.plan)}
                      </span>
                      <span className="font-mono text-xs text-muted shrink-0 w-16">
                        {p.count} × {formatMoney(p.count > 0 ? Math.round(p.mrrCents / p.count) : 0)}
                      </span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 shrink-0 text-right font-mono text-sm text-foreground">
                        {formatMoney(p.mrrCents)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}

        <p className="mt-5 text-xs text-muted">
          Stripe-backed billing arrives in Phase 4. Until then these
          numbers are sourced from <code className="font-mono">client.mrr_cents</code>{" "}
          you set manually.
        </p>
      </div>
    </section>
  );
}

function Hero({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent ring-1 ring-inset ring-accent/20">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {label}
        </p>
        <p className="mt-1 font-mono text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}

function planLabel(plan: string): string {
  if (plan === "checkup") return "Free Checkup";
  if (plan === "general") return "General Care";
  if (plan === "premium") return "Premium Care";
  return plan;
}

function formatMoney(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return `$${dollars.toFixed(0)}`;
}
