#!/usr/bin/env node
/** Read-only sanity check: prints what each STRIPE_PRICE_* env var
 *  resolves to on the Stripe side. Run after price changes to confirm. */

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

const wanted = [
  ["STRIPE_PRICE_GENERAL", "$299/mo"],
  ["STRIPE_PRICE_GENERAL_YEARLY", "$3,049/yr"],
  ["STRIPE_PRICE_PREMIUM", "$899/mo"],
  ["STRIPE_PRICE_PREMIUM_YEARLY", "$9,170/yr"],
  ["STRIPE_PRICE_CHECKUP", "$599 one-time"],
];

console.log("\n" + "=".repeat(70));
console.log("Stripe Price audit");
console.log("=".repeat(70));

for (const [key, expected] of wanted) {
  const id = env[key];
  if (!id) {
    console.log(`\n${key}\n  ⚠ NOT SET — expected ${expected}`);
    continue;
  }
  try {
    const p = await stripe.prices.retrieve(id);
    const amount = `$${(p.unit_amount / 100).toLocaleString()}`;
    const cadence = p.recurring
      ? `/${p.recurring.interval}`
      : " one-time";
    const flag = p.active ? "active" : "ARCHIVED";
    console.log(`\n${key}`);
    console.log(`  id:       ${id}`);
    console.log(`  expected: ${expected}`);
    console.log(`  actual:   ${amount}${cadence}  [${flag}]`);
  } catch (err) {
    console.log(`\n${key}\n  ✗ retrieve failed: ${err.message}`);
  }
}
console.log("\n" + "=".repeat(70) + "\n");
