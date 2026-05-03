#!/usr/bin/env node
/**
 * Audit + fix the monthly Stripe Prices to match the launch pricing
 * shown on the website ($299 General, $999 Premium).
 *
 * Stripe doesn't allow editing a Price's amount after creation, so:
 *   1. Inspect the current Price referenced by STRIPE_PRICE_GENERAL /
 *      STRIPE_PRICE_PREMIUM in .env.local.
 *   2. If the amount is wrong, create a new Price on the same Product at
 *      the correct amount, archive the old one (active=false), and print
 *      the new ID so the env can be updated.
 *   3. Existing subscriptions on the old Price keep billing at the old
 *      rate until you migrate them via the Stripe portal — the archive
 *      only blocks NEW signups from using the wrong price.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import Stripe from "stripe";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = parseEnv(resolve(__dirname, "..", ".env.local"));

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

function parseEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function auditAndFix({ envKey, label, targetCents, lookupKey, nickname }) {
  console.log(`\n→ ${label}`);
  const currentId = env[envKey];
  if (!currentId) {
    console.log(`  ⚠ ${envKey} not set — skipping`);
    return null;
  }

  const current = await stripe.prices.retrieve(currentId);
  const currentDollars = (current.unit_amount ?? 0) / 100;
  const targetDollars = targetCents / 100;
  const productId =
    typeof current.product === "string" ? current.product : current.product.id;

  console.log(`  current price: $${currentDollars}/mo  (${currentId})`);
  console.log(`  target price:  $${targetDollars}/mo`);

  if (current.unit_amount === targetCents && current.active) {
    console.log(`  ✓ already correct, no change needed`);
    return currentId;
  }

  // Look for an already-correct Price on this product (idempotency).
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.unit_amount === targetCents &&
      p.currency === "usd" &&
      p.recurring?.interval === "month" &&
      p.recurring?.interval_count === 1 &&
      p.id !== currentId
  );
  if (match) {
    console.log(`  ✓ found existing correct price: ${match.id}`);
    if (current.active) {
      await stripe.prices.update(currentId, { active: false });
      console.log(`  ↳ archived old: ${currentId}`);
    }
    return match.id;
  }

  // Create the right one.
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: targetCents,
    currency: "usd",
    recurring: { interval: "month", interval_count: 1 },
    nickname,
    lookup_key: lookupKey,
  });
  console.log(`  + created new price: ${created.id}`);

  // Archive the wrong-amount Price so the dashboard doesn't surface it.
  if (current.active) {
    await stripe.prices.update(currentId, { active: false });
    console.log(`  ↳ archived old: ${currentId}`);
  }
  return created.id;
}

async function main() {
  const generalId = await auditAndFix({
    envKey: "STRIPE_PRICE_GENERAL",
    label: "General Care — monthly target $299",
    targetCents: 29900,
    lookupKey: "general_care_monthly_v2",
    nickname: "General Care — $299/mo",
  });

  const premiumId = await auditAndFix({
    envKey: "STRIPE_PRICE_PREMIUM",
    label: "Premium Care — monthly target $999",
    targetCents: 99900,
    lookupKey: "premium_care_monthly_v2",
    nickname: "Premium Care — $999/mo",
  });

  console.log("\n────────────────────────────────────────────────────");
  console.log("Updated env values — replace STRIPE_PRICE_GENERAL / STRIPE_PRICE_PREMIUM:");
  if (generalId) console.log(`  STRIPE_PRICE_GENERAL=${generalId}`);
  if (premiumId) console.log(`  STRIPE_PRICE_PREMIUM=${premiumId}`);
  console.log("────────────────────────────────────────────────────\n");

  console.log("Reminder: any subscriptions already on the old Prices keep");
  console.log("billing at the old rate until you migrate them via the Stripe");
  console.log("portal (Subscription detail → Update price). Archiving only");
  console.log("blocks NEW signups from using the wrong amount.");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.raw) console.error(err.raw);
  process.exit(1);
});
