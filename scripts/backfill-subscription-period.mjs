#!/usr/bin/env node
/**
 * One-off backfill: for every client with a Stripe subscription, fetch
 * the live subscription and set client.currentPeriodEnd / trialEndsAt /
 * stripePriceId / mrrCents / cancelAtPeriodEnd from it.
 *
 * Why: a previous webhook bug read `subscription.current_period_end`
 * directly off the Subscription object, but Stripe API 2024-09+
 * (we're on 2026-04-22.dahlia) moved that field onto each
 * Subscription Item. Existing rows have null `currentPeriodEnd` →
 * the patient billing page renders "Renews on" blank.
 *
 * The webhook is now patched; this script repairs the existing data.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = parseEnv(resolve(__dirname, "..", ".env.local"));
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});
const sql = neon(env.DATABASE_URL);

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function planFromPriceId(priceId) {
  if (!priceId) return { plan: "general", interval: "monthly" };
  if (priceId === env.STRIPE_PRICE_PREMIUM_YEARLY)
    return { plan: "premium", interval: "yearly" };
  if (priceId === env.STRIPE_PRICE_PREMIUM)
    return { plan: "premium", interval: "monthly" };
  if (priceId === env.STRIPE_PRICE_GENERAL_YEARLY)
    return { plan: "general", interval: "yearly" };
  return { plan: "general", interval: "monthly" };
}

async function main() {
  const rows = await sql`
    SELECT id, name, stripe_subscription_id, current_period_end
    FROM client
    WHERE stripe_subscription_id IS NOT NULL
  `;
  console.log(`Found ${rows.length} clients with a Stripe subscription.`);

  for (const row of rows) {
    const subId = row.stripe_subscription_id;
    console.log(`\n→ ${row.name}  (${subId})`);
    let sub;
    try {
      sub = await stripe.subscriptions.retrieve(subId);
    } catch (err) {
      console.log(`  ✗ retrieve failed: ${err.message}`);
      continue;
    }

    const item = sub.items.data[0];
    const periodEndUnix =
      item?.current_period_end ?? sub.current_period_end ?? null;
    const periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
    const priceId = item?.price?.id ?? null;
    const billedAmount = item?.price?.unit_amount ?? 0;
    const { plan, interval } = planFromPriceId(priceId);
    const monthlyCents =
      interval === "yearly" ? Math.round(billedAmount / 12) : billedAmount;
    const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const isActive = sub.status === "active" || sub.status === "trialing";
    const cancelAtPeriodEnd = sub.cancel_at_period_end;

    console.log(
      `  status=${sub.status}  plan=${plan}  interval=${interval}  ` +
        `period_end=${periodEnd?.toISOString().slice(0, 10) ?? "—"}  ` +
        `mrr=$${monthlyCents / 100}/mo`
    );

    await sql`
      UPDATE client
      SET
        plan = ${plan},
        stripe_price_id = ${priceId},
        current_period_end = ${periodEnd},
        trial_ends_at = ${trialEndsAt},
        cancel_at_period_end = ${cancelAtPeriodEnd},
        mrr_cents = ${isActive && !cancelAtPeriodEnd ? monthlyCents : 0},
        status = ${isActive ? "active" : "lead"},
        updated_at = NOW()
      WHERE id = ${row.id}
    `;
    console.log(`  ✓ updated`);
  }

  console.log(`\nDone.`);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
