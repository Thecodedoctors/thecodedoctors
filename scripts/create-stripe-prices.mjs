#!/usr/bin/env node
/**
 * One-off: creates the new launch-pricing Stripe Prices and prints
 * their IDs ready for the Cloudflare Worker secrets.
 *
 *   - STRIPE_PRICE_GENERAL_YEARLY  ($3,049/yr, attached to existing General Care product)
 *   - STRIPE_PRICE_PREMIUM_YEARLY  ($10,189/yr, attached to existing Premium Care product)
 *   - STRIPE_PRICE_CHECKUP         ($599 one-time, new product "The Checkup")
 *
 * Idempotent-ish: looks for existing prices on each product with the
 * same lookup_key + nickname before creating a duplicate. Re-running
 * is safe — it'll print the existing IDs instead of making new ones.
 *
 * Run with:   node scripts/create-stripe-prices.mjs
 *
 * Reads .env.local for STRIPE_SECRET_KEY + the existing monthly Price IDs.
 * Delete this file after the IDs are wired up — it's launch ops, not
 * code we ship.
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

/** Fetch an existing Price and return its product id. */
async function productOfPrice(priceId) {
  if (!priceId) throw new Error(`Missing price id`);
  const price = await stripe.prices.retrieve(priceId);
  return typeof price.product === "string" ? price.product : price.product.id;
}

/** Find an existing recurring price by interval on a product, or create one. */
async function ensureRecurringPrice({ productId, lookupKey, nickname, amount, interval }) {
  const existing = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (p) =>
      p.lookup_key === lookupKey ||
      (p.recurring?.interval === interval &&
        p.recurring?.interval_count === 1 &&
        p.unit_amount === amount &&
        p.currency === "usd")
  );
  if (match) {
    console.log(`  ✓ already exists: ${match.id} (${nickname})`);
    return match.id;
  }
  const created = await stripe.prices.create({
    product: productId,
    unit_amount: amount,
    currency: "usd",
    recurring: { interval, interval_count: 1 },
    nickname,
    lookup_key: lookupKey,
  });
  console.log(`  + created: ${created.id} (${nickname})`);
  return created.id;
}

/** Find a one-time product by name or create it; ensure a $599 one-time price. */
async function ensureOneTimeCheckup() {
  const products = await stripe.products.search({
    query: `name:"The Checkup"`,
    limit: 10,
  });
  let product = products.data.find((p) => p.active);
  if (!product) {
    product = await stripe.products.create({
      name: "The Checkup",
      description:
        "48-hour deep audit of your site — 20+ page report, prioritized prescription, up to 3 page-level mockups for the highest-priority fixes.",
      type: "service",
      metadata: { source: "launch-pricing-script" },
    });
    console.log(`  + created product: ${product.id}`);
  } else {
    console.log(`  ✓ product exists: ${product.id}`);
  }

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: "one_time",
    limit: 10,
  });
  const target = 59900;
  const match = prices.data.find(
    (p) =>
      p.unit_amount === target &&
      p.currency === "usd" &&
      p.lookup_key === "checkup_onetime_v1"
  );
  if (match) {
    console.log(`  ✓ price exists: ${match.id}`);
    return match.id;
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: target,
    currency: "usd",
    nickname: "The Checkup — $599 one-time",
    lookup_key: "checkup_onetime_v1",
  });
  console.log(`  + created price: ${created.id}`);
  return created.id;
}

async function main() {
  console.log("\n→ General Care — adding yearly price");
  const generalProduct = await productOfPrice(env.STRIPE_PRICE_GENERAL);
  console.log(`  product: ${generalProduct}`);
  const generalYearly = await ensureRecurringPrice({
    productId: generalProduct,
    lookupKey: "general_care_yearly_v1",
    nickname: "General Care — $3,049/yr (15% off)",
    amount: 304900,
    interval: "year",
  });

  console.log("\n→ Premium Care — adding yearly price");
  const premiumProduct = await productOfPrice(env.STRIPE_PRICE_PREMIUM);
  console.log(`  product: ${premiumProduct}`);
  const premiumYearly = await ensureRecurringPrice({
    productId: premiumProduct,
    lookupKey: "premium_care_yearly_v1",
    nickname: "Premium Care — $10,189/yr (15% off)",
    amount: 1018900,
    interval: "year",
  });

  console.log("\n→ The Checkup — one-time");
  const checkup = await ensureOneTimeCheckup();

  console.log("\n────────────────────────────────────────────────────");
  console.log("Add these as Cloudflare Worker secrets (or .env.local):");
  console.log(`  STRIPE_PRICE_GENERAL_YEARLY=${generalYearly}`);
  console.log(`  STRIPE_PRICE_PREMIUM_YEARLY=${premiumYearly}`);
  console.log(`  STRIPE_PRICE_CHECKUP=${checkup}`);
  console.log("────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.raw) console.error(err.raw);
  process.exit(1);
});
