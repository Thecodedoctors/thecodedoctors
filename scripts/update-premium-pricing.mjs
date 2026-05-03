#!/usr/bin/env node
/**
 * Migrate Premium Care pricing: $999/mo → $899/mo, and the corresponding
 * yearly: $10,189/yr → $9,170/yr (15% off the new monthly).
 *
 * Stripe Prices are immutable once created — so we make new ones at the
 * correct amount, archive the old ones, and print the new IDs to wire
 * into env vars. Existing subscriptions on the old Prices keep billing
 * at the old rate until you migrate them via the dashboard.
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

async function migrate({
  envKey,
  label,
  targetCents,
  interval,
  lookupKey,
  nickname,
}) {
  console.log(`\n→ ${label}`);
  const currentId = env[envKey];
  if (!currentId) {
    console.log(`  ⚠ ${envKey} not set — skipping`);
    return null;
  }

  const current = await stripe.prices.retrieve(currentId);
  const productId =
    typeof current.product === "string"
      ? current.product
      : current.product.id;
  const cur$ = (current.unit_amount ?? 0) / 100;
  const tgt$ = targetCents / 100;
  console.log(`  current: $${cur$}/${interval}  (${currentId})`);
  console.log(`  target:  $${tgt$}/${interval}`);

  if (current.unit_amount === targetCents && current.active) {
    console.log(`  ✓ already correct`);
    return currentId;
  }

  // Look for an already-created correct Price on this product.
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.unit_amount === targetCents &&
      p.currency === "usd" &&
      p.recurring?.interval === interval &&
      p.recurring?.interval_count === 1 &&
      p.id !== currentId
  );
  let newId;
  if (match) {
    console.log(`  ✓ correct Price already exists: ${match.id}`);
    newId = match.id;
  } else {
    const created = await stripe.prices.create({
      product: productId,
      unit_amount: targetCents,
      currency: "usd",
      recurring: { interval, interval_count: 1 },
      nickname,
      lookup_key: lookupKey,
    });
    console.log(`  + created: ${created.id}`);
    newId = created.id;
  }

  if (current.active) {
    await stripe.prices.update(currentId, { active: false });
    console.log(`  ↳ archived old: ${currentId}`);
  }
  return newId;
}

async function main() {
  const monthlyId = await migrate({
    envKey: "STRIPE_PRICE_PREMIUM",
    label: "Premium Care — monthly  $999 → $899",
    targetCents: 89900,
    interval: "month",
    lookupKey: "premium_care_monthly_v3",
    nickname: "Premium Care — $899/mo",
  });

  const yearlyId = await migrate({
    envKey: "STRIPE_PRICE_PREMIUM_YEARLY",
    label: "Premium Care — yearly  $10,189 → $9,170 (15% off the new $899)",
    targetCents: 917000,
    interval: "year",
    lookupKey: "premium_care_yearly_v2",
    nickname: "Premium Care — $9,170/yr (15% off)",
  });

  console.log("\n────────────────────────────────────────────────────");
  console.log("Updated env values:");
  if (monthlyId) console.log(`  STRIPE_PRICE_PREMIUM=${monthlyId}`);
  if (yearlyId) console.log(`  STRIPE_PRICE_PREMIUM_YEARLY=${yearlyId}`);
  console.log("────────────────────────────────────────────────────\n");
  console.log("Reminder: existing subscriptions on the old prices keep");
  console.log("billing at the old rate until manually migrated via the");
  console.log("Stripe dashboard. Archive only blocks NEW signups.");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.raw) console.error(err.raw);
  process.exit(1);
});
