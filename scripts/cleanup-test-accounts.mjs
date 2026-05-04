#!/usr/bin/env node
/**
 * Wipe every non-founder account: cancels their Stripe subscription,
 * deletes their client + user rows (cascades take care of dependents).
 *
 * Founder rows (role = 'founder') are left untouched.
 *
 * Run before reseeding test fixtures so the DB starts from a clean,
 * predictable state. Idempotent — re-running does nothing once clean.
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

async function main() {
  // Find founders.
  const founders = await sql`SELECT id, email FROM "user" WHERE role = 'founder'`;
  if (founders.length === 0) {
    console.error("No founder user found — refusing to wipe.");
    process.exit(1);
  }
  const founderIds = founders.map((f) => f.id);
  console.log(`Founders preserved: ${founders.map((f) => f.email).join(", ")}`);

  // Cancel Stripe subs on every non-founder client. Using `<> ALL(array)`
  // keeps this safe with multiple founders without needing dynamic SQL.
  const clients = await sql`
    SELECT id, name, stripe_subscription_id, stripe_customer_id
    FROM client
    WHERE primary_user_id IS NULL
       OR primary_user_id <> ALL(${founderIds})
  `;
  console.log(`\n${clients.length} non-founder clients to clean.`);

  for (const c of clients) {
    if (c.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(c.stripe_subscription_id, {
          invoice_now: false,
          prorate: false,
        });
        console.log(`  ✓ canceled Stripe sub ${c.stripe_subscription_id} (${c.name})`);
      } catch (err) {
        // Already canceled / not found — ignore, just log.
        console.log(`  · stripe cancel skipped for ${c.stripe_subscription_id}: ${err.message}`);
      }
    }
  }

  // Delete in dependency order. Most tables have onDelete: cascade off
  // user/client, but a few are set null so we explicitly clear them.
  console.log(`\nDeleting DB rows…`);

  // Audit log refs are set-null, so users/clients can be deleted.
  // FK cascades handle: client_member, request, message, file (mostly),
  // notification, incident, monthly_report, client_backup, credential_request.

  // Delete clients (FK cascades will handle related rows).
  const cd = await sql`
    DELETE FROM client
    WHERE primary_user_id IS NULL
       OR primary_user_id <> ALL(${founderIds})
  `;
  console.log(`  ✓ deleted clients: ${cd.length ?? cd.rowCount ?? "?"}`);

  // Delete pending signups (test signups in flight).
  const pd = await sql`DELETE FROM pending_signup`;
  console.log(`  ✓ cleared pending_signups: ${pd.length ?? pd.rowCount ?? "?"}`);

  // Delete non-founder users (cascades clean notifications, sessions, etc.).
  const ud = await sql`
    DELETE FROM "user"
    WHERE id <> ALL(${founderIds})
  `;
  console.log(`  ✓ deleted non-founder users: ${ud.length ?? ud.rowCount ?? "?"}`);

  // Sanity check.
  const remaining = await sql`SELECT email, role FROM "user" ORDER BY created_at`;
  console.log(`\n${remaining.length} users remain:`);
  for (const u of remaining) console.log(`  ${u.email}  role=${u.role}`);
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
