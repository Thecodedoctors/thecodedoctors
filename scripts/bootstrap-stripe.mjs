/**
 * One-shot bootstrap: creates the General Care + Premium Care products
 * with monthly USD prices in Stripe (test mode, since we're using
 * sk_test_...). Idempotent — looks up by metadata.key first.
 *
 * Run via: node scripts/bootstrap-stripe.mjs
 */

import fs from "node:fs";
import Stripe from "stripe";

const envText = fs.readFileSync(".env.local", "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2026-04-22.dahlia" });

const PLANS = [
  {
    key: "general",
    name: "General Care",
    description:
      "Two doctor-hours per week, 24/7 monitoring, weekly health check, security patches.",
    monthlyUsdCents: 90000, // $900
  },
  {
    key: "premium",
    name: "Premium Care",
    description:
      "Five doctor-hours per week, priority response, dedicated security review, performance budget enforcement.",
    monthlyUsdCents: 240000, // $2,400
  },
];

async function findOrCreateProduct(plan) {
  const existing = await stripe.products.search({
    query: `metadata['planKey']:'${plan.key}' AND active:'true'`,
  });
  if (existing.data.length > 0) {
    console.log(`  ${plan.name} product exists → ${existing.data[0].id}`);
    return existing.data[0];
  }
  const created = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: { planKey: plan.key },
  });
  console.log(`  Created product ${plan.name} → ${created.id}`);
  return created;
}

async function findOrCreatePrice(product, plan) {
  const existing = await stripe.prices.search({
    query: `metadata['planKey']:'${plan.key}' AND active:'true'`,
  });
  if (existing.data.length > 0) {
    console.log(`    Price exists → ${existing.data[0].id}`);
    return existing.data[0];
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: plan.monthlyUsdCents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { planKey: plan.key },
    nickname: `${plan.name} · monthly`,
  });
  console.log(`    Created price → ${created.id}`);
  return created;
}

async function main() {
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    console.error("STRIPE_SECRET_KEY missing or malformed in .env.local");
    process.exit(1);
  }
  console.log("Bootstrapping Stripe products + prices...\n");
  const priceIds = {};
  for (const plan of PLANS) {
    console.log(plan.name);
    const product = await findOrCreateProduct(plan);
    const price = await findOrCreatePrice(product, plan);
    priceIds[plan.key] = price.id;
  }

  console.log("\nWriting price IDs to .env.local...");
  let next = envText;
  for (const [key, id] of Object.entries(priceIds)) {
    const envKey = `STRIPE_PRICE_${key.toUpperCase()}`;
    const line = `${envKey}=${id}`;
    if (next.match(new RegExp(`^${envKey}=`, "m"))) {
      next = next.replace(new RegExp(`^${envKey}=.*$`, "m"), line);
    } else {
      next += (next.endsWith("\n") ? "" : "\n") + line + "\n";
    }
  }
  fs.writeFileSync(".env.local", next);
  console.log("Done.\n");
  console.log("Price IDs:", priceIds);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
