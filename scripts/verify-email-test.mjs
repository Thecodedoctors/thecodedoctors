#!/usr/bin/env node
/**
 * End-to-end test of the email verification feature.
 *
 * Steps:
 *   1. Disposable rejection — submits /start with mailinator.com,
 *      expects the form to render an error and not proceed to Stripe.
 *   2. Full signup with a valid-MX domain (gmail.com) → Stripe Checkout
 *      → /welcome → dashboard. Confirms the unverified banner is
 *      visible.
 *   3. Reads the magic-link token directly from the user row in DB.
 *      We can't read the actual email inbox so we substitute by
 *      grabbing the same token the email contains.
 *   4. Visits /verify-email?token=<that token>. Expects redirect to
 *      /dashboard?verified=just-now, the banner gone, and
 *      emailVerified populated in the DB.
 *   5. Cleans up the test user + Stripe customer.
 *
 * Run: node scripts/verify-email-test.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, "verify-email-test-shots");
if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const APEX = "https://thecodedoctors.com";
const APP = "https://app.thecodedoctors.com";

function parseEnv(p) {
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = parseEnv(resolve(__dirname, "..", ".env.local"));
const sql = neon(env.DATABASE_URL);
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-04-22.dahlia",
});

const TEST_CARD = {
  number: "4242424242424242",
  expiry: "12 / 30",
  cvc: "314",
  postal: "10001",
};

const findings = [];
let stepCounter = 0;

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${msg}`);
}

function record(severity, title, ctx = {}) {
  findings.push({ severity, title, ...ctx });
  log(`  ⚠ [${severity}] ${title}${ctx.url ? `  (${ctx.url})` : ""}`);
}

async function shot(page, label) {
  const safe = label.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);
  await page
    .screenshot({
      path: resolve(
        SHOTS_DIR,
        `${String(++stepCounter).padStart(3, "0")}_${safe}.png`
      ),
      fullPage: false,
    })
    .catch(() => {});
}

/* ─── Stripe Checkout filler — same logic as submit-walkthrough.mjs ─── */

async function fillStripeCheckout(page) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  const ccTopLevel = page
    .locator('input[name="cardNumber"], input[autocomplete="cc-number"]')
    .first();
  let cardFilled = false;
  if (await ccTopLevel.count()) {
    await ccTopLevel.fill(TEST_CARD.number);
    cardFilled = true;
    const exp = page
      .locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]')
      .first();
    if (await exp.count()) await exp.fill(TEST_CARD.expiry);
    const cvc = page
      .locator('input[name="cardCvc"], input[autocomplete="cc-csc"]')
      .first();
    if (await cvc.count()) await cvc.fill(TEST_CARD.cvc);
  }
  if (!cardFilled) {
    for (const f of page.frames()) {
      const cc = f
        .locator('input[name="cardnumber"], input[autocomplete="cc-number"]')
        .first();
      if (await cc.count().catch(() => 0)) {
        await cc.fill(TEST_CARD.number).catch(() => {});
        const exp = f
          .locator('input[name="exp-date"], input[autocomplete="cc-exp"]')
          .first();
        if (await exp.count().catch(() => 0))
          await exp.fill(TEST_CARD.expiry).catch(() => {});
        const cvc = f
          .locator('input[name="cvc"], input[autocomplete="cc-csc"]')
          .first();
        if (await cvc.count().catch(() => 0))
          await cvc.fill(TEST_CARD.cvc).catch(() => {});
        cardFilled = true;
        break;
      }
    }
  }
  if (!cardFilled) {
    record("P0", "Stripe: card field not found", { url: page.url() });
    return false;
  }

  const name = page
    .locator('input[name="billingName"], input[autocomplete="cc-name"]')
    .first();
  if (
    (await name.count()) &&
    !(await name.inputValue().catch(() => ""))
  ) {
    await name.fill("Verify Test").catch(() => {});
  }
  const postal = page
    .locator(
      'input[name="billingPostalCode"], input[autocomplete="postal-code"]'
    )
    .first();
  if (
    (await postal.count()) &&
    !(await postal.inputValue().catch(() => ""))
  ) {
    await postal.fill(TEST_CARD.postal).catch(() => {});
  }

  // Untick "Save my info" — same as submit-walkthrough's patch.
  for (const box of await page
    .locator(
      'input[type="checkbox"][id*="enableStripePass" i], input[type="checkbox"][name*="enable" i]'
    )
    .all()) {
    try {
      if (await box.isChecked()) await box.uncheck({ force: true });
    } catch {}
  }

  const pay = page
    .locator(
      'button[type="submit"]:has-text("Pay"), button[type="submit"]:has-text("Subscribe"), button[type="submit"]:has-text("Start trial")'
    )
    .first();
  await pay.click();
  await page.waitForURL(/\/welcome\?/, { timeout: 60000 });
  return true;
}

/* ─── Test 1: Disposable email rejected ─────────────────────────────── */

async function testDisposableRejection(browser) {
  log("\n=== Test 1: Disposable email rejection ===\n");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  await page.goto(APEX + "/start?plan=general&interval=monthly", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  await page.locator('input[name="name"]').first().fill("Verify Test");
  await page
    .locator('input[name="businessName"]')
    .first()
    .fill("Verify Test Co");
  await page.locator('input[name="websiteUrl"]').first().fill("example.com");
  await page
    .locator('input[name="email"]')
    .first()
    .fill(`verify-test-${Date.now()}@mailinator.com`);
  await page.locator('input[name="password"]').first().fill("Doctor1234!");
  await shot(page, "disposable_filled");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  await shot(page, "disposable_result");

  const url = page.url();
  const body = await page.locator("body").innerText().catch(() => "");
  if (url.includes("checkout.stripe.com")) {
    record("P0", "Disposable email allowed through to Stripe", { url });
  } else if (
    /disposable|use a real email|throwaway/i.test(body) ||
    /can't receive your invoices/i.test(body)
  ) {
    log("  ✓ disposable email rejected with proper error");
  } else {
    record("P1", "Disposable email rejected but no specific error visible", {
      url,
    });
  }
  await ctx.close();
}

/* ─── Test 2 + 3: Full signup → magic link verify ───────────────────── */

async function testFullVerifyFlow(browser) {
  log("\n=== Test 2: Full signup with valid-MX email ===\n");
  const email = `verify-test-${Date.now()}@gmail.com`;
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  await page.goto(APEX + "/start?plan=general&interval=monthly", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(800);
  await page.locator('input[name="name"]').first().fill("Verify Test");
  await page
    .locator('input[name="businessName"]')
    .first()
    .fill("Verify Test Co");
  await page.locator('input[name="websiteUrl"]').first().fill("example.com");
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill("Doctor1234!");
  await shot(page, "valid_filled");
  await page.locator('button[type="submit"]').first().click();
  log(`→ submitted form with ${email}, waiting for Stripe…`);

  const filled = await fillStripeCheckout(page);
  if (!filled) {
    await ctx.close();
    return null;
  }

  log("→ Pay clicked, waiting for /welcome → /dashboard…");
  await page.waitForURL(/(?:dashboard|app\.thecodedoctors\.com)/, {
    timeout: 60000,
  });
  await page.waitForTimeout(5000); // give finalize + email send a moment
  await shot(page, "post_signup_dashboard");

  // Check: is the unverified banner present?
  const bannerVisible = await page
    .locator("text=/Quick housekeeping/i")
    .count()
    .catch(() => 0);
  if (bannerVisible > 0) {
    log("  ✓ unverified banner visible on dashboard");
  } else {
    record("P1", "Unverified banner not visible after signup", {
      url: page.url(),
    });
  }

  // Read the magic-link token from DB.
  const rows = await sql`
    SELECT id, email, email_verification_token, "emailVerified"
    FROM "user"
    WHERE email = ${email}
    LIMIT 1
  `;
  const dbUser = rows[0];
  if (!dbUser) {
    record("P0", "DB has no row for the new user", { url: page.url() });
    await ctx.close();
    return null;
  }
  if (dbUser.emailVerified) {
    record("P0", "User has emailVerified set already (should be null)", {
      email,
    });
  }
  if (!dbUser.email_verification_token) {
    record("P0", "User has no email_verification_token (send may have failed)");
    await ctx.close();
    return null;
  }
  log(
    `  ✓ DB confirmed: emailVerified=null, token=${dbUser.email_verification_token.slice(0, 8)}…`
  );

  // === Test 3: Hit the magic link ===
  log("\n=== Test 3: Magic-link verification ===\n");
  await page.goto(
    `${APEX}/verify-email?token=${encodeURIComponent(dbUser.email_verification_token)}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForTimeout(3000);
  await shot(page, "magic_link_landing");

  // Should have redirected to /dashboard?verified=just-now (cross-domain).
  const finalUrl = page.url();
  if (
    !/app\.thecodedoctors\.com/.test(finalUrl) ||
    !finalUrl.includes("verified=just-now")
  ) {
    record("P0", `Magic link didn't redirect to dashboard?verified=just-now`, {
      url: finalUrl,
    });
  } else {
    log("  ✓ redirected to dashboard?verified=just-now");
  }

  // Banner should be gone now.
  const bannerStill = await page
    .locator("text=/Quick housekeeping/i")
    .count()
    .catch(() => 0);
  if (bannerStill > 0) {
    record("P1", "Unverified banner still visible after verification", {
      url: finalUrl,
    });
  } else {
    log("  ✓ unverified banner gone after verification");
  }

  // DB should now show emailVerified populated, token cleared.
  const after = await sql`
    SELECT "emailVerified", email_verification_token, email_verification_code_hash
    FROM "user"
    WHERE id = ${dbUser.id}
  `;
  if (!after[0]?.emailVerified) {
    record("P0", "DB: emailVerified still null after magic-link visit");
  } else {
    log(
      `  ✓ DB: emailVerified set to ${new Date(after[0].emailVerified).toISOString()}`
    );
  }
  if (after[0]?.email_verification_token || after[0]?.email_verification_code_hash) {
    record(
      "P1",
      "DB: verification token/code-hash not cleared after verification"
    );
  } else {
    log("  ✓ DB: verification token + code-hash cleared");
  }

  await ctx.close();
  return { userId: dbUser.id, email };
}

/* ─── Cleanup ───────────────────────────────────────────────────────── */

async function cleanup(testUser) {
  if (!testUser) return;
  log("\n=== Cleanup ===\n");

  // Cancel any Stripe sub for this user's client, then delete user.
  const rows = await sql`
    SELECT c.stripe_subscription_id, c.stripe_customer_id
    FROM client c
    WHERE c.primary_user_id = ${testUser.userId}
  `;
  for (const r of rows) {
    if (r.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(r.stripe_subscription_id, {
          invoice_now: false,
          prorate: false,
        });
        log(`  ✓ canceled Stripe sub ${r.stripe_subscription_id}`);
      } catch (err) {
        log(`  · stripe cancel skipped: ${err.message}`);
      }
    }
  }
  await sql`DELETE FROM client WHERE primary_user_id = ${testUser.userId}`;
  await sql`DELETE FROM "user" WHERE id = ${testUser.userId}`;
  log(`  ✓ cleaned up test user ${testUser.email}`);
}

/* ─── Main ──────────────────────────────────────────────────────────── */

async function main() {
  log("Launching Chromium (headed). Watching mode.\n");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
    args: ["--window-size=1320,860"],
  });

  let testUser = null;
  try {
    await testDisposableRejection(browser);
    testUser = await testFullVerifyFlow(browser);
  } finally {
    await browser.close();
  }

  await cleanup(testUser);

  log("\n\n=== Email-verification test complete ===\n");
  if (findings.length === 0) {
    log("✓ All checks passed.");
  } else {
    log(`Found ${findings.length} issue(s):\n`);
    findings.forEach((f, i) => {
      console.log(`${i + 1}. [${f.severity}] ${f.title}`);
      if (f.url) console.log(`   URL:  ${f.url}`);
    });
  }
  log(`\nScreenshots: ${SHOTS_DIR}`);

  writeFileSync(
    resolve(SHOTS_DIR, "_findings.txt"),
    findings.length === 0
      ? "(no findings — email verification works end-to-end)"
      : findings
          .map(
            (f, i) =>
              `${i + 1}. [${f.severity}] ${f.title}${f.url ? `\n   ${f.url}` : ""}`
          )
          .join("\n"),
    "utf8"
  );
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
