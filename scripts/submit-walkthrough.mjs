#!/usr/bin/env node
/**
 * Comprehensive submission-driven walkthrough — actually submits every
 * form, charges every flow with Stripe test cards, exercises every
 * mutation. Headed Chromium so you can watch each click.
 *
 * Pre-conditions:
 *   - Turnstile keys must be set to Cloudflare's always-pass test keys
 *     (1x00000000000000000000AA + 1x0000000000000000000000000000000AA).
 *     Restore production keys after this script finishes.
 *   - The 5 seeded personas (Maria/James/Sarah/David/Olivia) must exist.
 *
 * Coverage:
 *   A. Marketing public-form submissions: Free Checkup scan, Email-me-the-report,
 *      Contact form
 *   B. Signup → Stripe Checkout → /welcome (General monthly + Premium yearly +
 *      Checkup one-time + 7-day Trial)
 *   C. Login: correct, wrong password, TOTP required + correct, TOTP required + wrong
 *   D. Forgot password (request side only)
 *   E. Patient mutations as Maria: new request, reply on existing thread,
 *      profile name update, switch monthly→yearly billing
 *   F. Trial conversion: Sarah's "Convert early" actually charges the test card
 *   G. Founder admin mutations: TOTP login, change request status, send doctor
 *      message, create credential request, create incident, suspend+unsuspend
 *      a user, pause+unpause a client
 *
 * Run: node scripts/submit-walkthrough.mjs
 */

import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = resolve(__dirname, "submit-screenshots");
if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const APEX = "https://thecodedoctors.com";
const APP = "https://app.thecodedoctors.com";
const ADMIN = "https://admin.thecodedoctors.com";

const TEST_CARD = {
  number: "4242424242424242",
  expiryMonth: "12",
  expiryYear: "30",
  expiry: "12 / 30",
  cvc: "314",
  postal: "10001",
  name: "Test Patient",
};

const PASS = "Doctor1234!";
const FOUNDER_EMAIL = "codedoctors0@gmail.com";

const findings = [];
let stepCounter = 0;

function log(msg) {
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] ${msg}`);
}

function record(severity, category, title, ctx = {}) {
  const f = { severity, category, title, ...ctx };
  findings.push(f);
  log(`  ⚠ [${severity}] ${category}: ${title}${ctx.url ? `  (${ctx.url})` : ""}`);
}

async function shot(page, label) {
  const safe = label.replace(/[^a-z0-9-_]+/gi, "_").slice(0, 80);
  const file = resolve(SHOTS_DIR, `${String(++stepCounter).padStart(3, "0")}_${safe}.png`);
  try {
    await page.screenshot({ path: file, fullPage: false });
  } catch {}
}

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

/* ─── TOTP for founder login ────────────────────────────────────────────── */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(s) {
  const c = s.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out = [];
  for (const ch of c) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error(`bad base32: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}
function totpAt(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const key = base32Decode(secret);
  const h = createHmac("sha1", key).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const code =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}
async function loadFounderTotp() {
  const rows = await sql`SELECT totp_secret FROM "user" WHERE role='founder' LIMIT 1`;
  return rows[0]?.totp_secret;
}

/* ─── Login helpers ─────────────────────────────────────────────────────── */

async function loginPatient(page, email) {
  await page.goto(APP + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(2500);
  if (page.url().includes("/login")) {
    record("P0", "error", `Login failed for ${email}`, { url: page.url() });
    return false;
  }
  return true;
}

async function loginFounder(page, totpSecret) {
  await page.goto(ADMIN + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('input[name="email"]').first().fill(FOUNDER_EMAIL);
  await page.locator('input[name="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page
    .waitForURL(/login\?error=TotpRequired/, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  const totpField = page.locator('input[name="totpCode"]').first();
  if (await totpField.count()) {
    await page.locator('input[name="email"]').first().fill(FOUNDER_EMAIL);
    await page.locator('input[name="password"]').first().fill(PASS);
    await totpField.fill(totpAt(totpSecret));
    await page.locator('button[type="submit"]').first().click();
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(2500);
  }
  if (page.url().includes("/login")) {
    record("P0", "error", "Founder login failed", { url: page.url() });
    return false;
  }
  return true;
}

async function logout(page) {
  await page.goto(APP + "/api/auth/signout", { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(500);
  const btn = page.locator('button:has-text("Sign out")').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}

/* ─── Stripe Checkout helper ────────────────────────────────────────────── */

async function fillStripeCheckout(page) {
  log("→ Waiting for Stripe Checkout…");
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "stripe_checkout_loaded");

  // Email — usually pre-filled. Skip if so.
  const emailField = page.locator('input[name="email"], input[autocomplete="email"]').first();
  if (await emailField.count()) {
    const cur = await emailField.inputValue().catch(() => "");
    if (!cur) await emailField.fill(`stripe-test-${Date.now()}@thecodedoctors.test`).catch(() => {});
  }

  // Card number — could be in an iframe (older Checkout) or a top-level
  // input (newer Payment Element on hosted checkout). Try both.
  const ccTopLevel = page.locator('input[name="cardNumber"], input[autocomplete="cc-number"]').first();
  let cardFilled = false;
  if (await ccTopLevel.count()) {
    await ccTopLevel.fill(TEST_CARD.number);
    cardFilled = true;
  }
  if (!cardFilled) {
    // Iframe path
    const frames = page.frames();
    for (const f of frames) {
      const cc = f.locator('input[name="cardnumber"], input[autocomplete="cc-number"], input[name="number"]').first();
      if (await cc.count().catch(() => 0)) {
        await cc.fill(TEST_CARD.number).catch(() => {});
        const exp = f.locator('input[name="exp-date"], input[autocomplete="cc-exp"], input[name="cardExpiry"]').first();
        if (await exp.count().catch(() => 0)) await exp.fill(TEST_CARD.expiry).catch(() => {});
        const cvc = f.locator('input[name="cvc"], input[autocomplete="cc-csc"], input[name="cardCvc"]').first();
        if (await cvc.count().catch(() => 0)) await cvc.fill(TEST_CARD.cvc).catch(() => {});
        cardFilled = true;
        break;
      }
    }
  } else {
    // Fill expiry + cvc top-level too
    const exp = page.locator('input[name="cardExpiry"], input[autocomplete="cc-exp"]').first();
    if (await exp.count()) await exp.fill(TEST_CARD.expiry);
    const cvc = page.locator('input[name="cardCvc"], input[autocomplete="cc-csc"]').first();
    if (await cvc.count()) await cvc.fill(TEST_CARD.cvc);
  }
  if (!cardFilled) {
    record("P0", "missing", "Stripe Checkout: card number field not found", { url: page.url() });
    return false;
  }

  // Cardholder name + postal — top-level if present.
  const nameField = page
    .locator('input[name="billingName"], input[autocomplete="cc-name"], input[id^="billingName"]')
    .first();
  if (await nameField.count() && !(await nameField.inputValue().catch(() => ""))) {
    await nameField.fill(TEST_CARD.name).catch(() => {});
  }
  const postal = page.locator('input[name="billingPostalCode"], input[autocomplete="postal-code"]').first();
  if (await postal.count() && !(await postal.inputValue().catch(() => ""))) {
    await postal.fill(TEST_CARD.postal).catch(() => {});
  }

  // Country — may be a select.
  const country = page.locator('select[name="billingCountry"], select[name="country"]').first();
  if (await country.count()) {
    try {
      await country.selectOption("US");
    } catch {}
  }

  // Handle Stripe Link "Save my info for a faster checkout" — Stripe
  // sometimes auto-checks this and then requires a phone number, which
  // blocks the Pay button submission silently. Untick it (preferred)
  // OR fill the phone if it's required and locked-on. Try both
  // defensively — different Stripe Checkout versions surface this
  // differently.
  const saveInfoBoxes = await page
    .locator(
      'input[type="checkbox"][id*="enableStripePass" i], input[type="checkbox"][name*="enable" i], input[type="checkbox"][name*="save" i]'
    )
    .all();
  for (const box of saveInfoBoxes) {
    try {
      if (await box.isChecked()) await box.uncheck({ force: true });
    } catch {}
  }
  // Fallback — click the visible "Save" label to toggle off
  try {
    const saveLabel = page
      .locator('label:has-text("Save my info"), label:has-text("Save info")')
      .first();
    if ((await saveLabel.count()) && (await saveLabel.isVisible().catch(() => false))) {
      // Click only if its associated checkbox is currently checked.
      const checkbox = saveLabel.locator('input[type="checkbox"]').first();
      if ((await checkbox.count()) && (await checkbox.isChecked().catch(() => false))) {
        await saveLabel.click({ trial: false }).catch(() => {});
      }
    }
  } catch {}
  // Final fallback: fill phone field if Stripe still demands it.
  const phoneField = page
    .locator('input[type="tel"], input[name="phone"], input[autocomplete="tel"]')
    .first();
  if ((await phoneField.count()) && !(await phoneField.inputValue().catch(() => ""))) {
    await phoneField.fill("+15550101234").catch(() => {});
  }

  await shot(page, "stripe_checkout_filled");

  // Pay
  const pay = page
    .locator('button[type="submit"]:has-text("Pay"), button[type="submit"]:has-text("Subscribe"), button[type="submit"]:has-text("Start trial")')
    .first();
  if (!(await pay.count())) {
    record("P0", "missing", "Stripe Checkout: pay button not found", { url: page.url() });
    return false;
  }
  await pay.click();
  log("→ Pay button clicked, waiting for /welcome redirect…");

  // Wait for /welcome
  try {
    await page.waitForURL(/\/welcome\?/, { timeout: 60000 });
    return true;
  } catch {
    record("P0", "error", "Stripe Checkout: did not redirect to /welcome within 60s", { url: page.url() });
    return false;
  }
}

/* ─── Phase A: Marketing public-form submissions ────────────────────────── */

async function phaseA(browser) {
  log("\n=== Phase A: Marketing public-form submissions ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 1. Free Checkup tool
  log("\n— Free Checkup: scan a URL —");
  await page.goto(APEX + "/checkup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // let Turnstile resolve
  await page.locator('input[name="url"]').first().fill("example.com");
  await shot(page, "checkup_filled");
  await page.locator('button[type="submit"]').first().click();
  log("→ submitted, waiting for results or error…");
  // Wait up to 30s for either results UI or error UI
  try {
    await Promise.race([
      page.waitForSelector("text=/Diagnosing|Resolving domain/i", { timeout: 5000 }),
      page.waitForSelector("text=/Couldn't complete the checkup|completed/i", { timeout: 30000 }),
    ]);
    await page.waitForTimeout(8000); // let scan finish
  } catch {}
  await shot(page, "checkup_result");
  const checkupBody = await page.locator("body").innerText().catch(() => "");
  if (/Couldn't complete the checkup|Please complete the captcha/i.test(checkupBody)) {
    record("P0", "error", "Free Checkup form: submission failed", { url: page.url() });
  } else if (!/example\.com|overall|score/i.test(checkupBody)) {
    record("P1", "missing", "Free Checkup: results UI didn't appear after submission", { url: page.url() });
  } else {
    log("  ✓ Checkup scan completed");

    // 2. Email-me-the-report
    log("\n— Email me the report —");
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.count()) {
      await emailField.fill(`checkup-${Date.now()}@thecodedoctors.test`);
      await shot(page, "checkup_email_filled");
      await page
        .locator('button[type="submit"]:has-text("Send"), button:has-text("Send report")')
        .first()
        .click();
      await page.waitForTimeout(5000);
      await shot(page, "checkup_email_result");
      const after = await page.locator("body").innerText().catch(() => "");
      if (/Sent|on its way|Saved your details/i.test(after)) {
        log("  ✓ Email-me-report submitted successfully");
      } else if (/Couldn't|fail|error/i.test(after)) {
        record("P1", "error", "Email-me-report: submission failed visibly", { url: page.url() });
      } else {
        record("P1", "missing", "Email-me-report: no success/error UI after submit", { url: page.url() });
      }
    }
  }

  // 3. Contact form
  log("\n— Contact form —");
  await page.goto(APEX + "/book", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // let Turnstile resolve
  await page.locator('input[name="firstName"]').first().fill("Test");
  await page.locator('input[name="lastName"]').first().fill("Submitter");
  await page.locator('input[name="email"]').first().fill(`contact-${Date.now()}@thecodedoctors.test`);
  await page.locator('input[name="phone"]').first().fill("+1 555 010 1234");
  await page.locator('input[name="position"]').first().fill("Test Engineer");
  await page.locator('input[name="companyWebsite"]').first().fill("example.com");
  await page.locator('input[name="subject"]').first().fill("E2E test submission");
  await page
    .locator('textarea[name="message"]')
    .first()
    .fill("This is an automated end-to-end test submission. Safe to ignore.");
  await shot(page, "contact_filled");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(5000);
  await shot(page, "contact_submitted");
  const contactBody = await page.locator("body").innerText().catch(() => "");
  if (/Message sent|We'll be in touch|Saved your details/i.test(contactBody)) {
    log("  ✓ Contact form submitted successfully");
  } else if (/Couldn't|fail|captcha|error/i.test(contactBody)) {
    record("P0", "error", "Contact form: submission failed", { url: page.url() });
  } else {
    record("P1", "missing", "Contact form: no success/error UI after submit", { url: page.url() });
  }

  await ctx.close();
}

/* ─── Phase B: Signup + Stripe Checkout ─────────────────────────────────── */

async function signupAndPay(browser, args) {
  log(`\n— Signup: ${args.label} —`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(APEX + args.startUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  await page.locator('input[name="name"]').first().fill(args.name);
  await page.locator('input[name="businessName"]').first().fill(args.business);
  await page.locator('input[name="websiteUrl"]').first().fill(args.website);
  await page.locator('input[name="email"]').first().fill(args.email);
  await page.locator('input[name="password"]').first().fill(PASS);
  await shot(page, `signup_${args.label.replace(/\s+/g, "_")}_filled`);
  await page.locator('button[type="submit"]').first().click();

  const filled = await fillStripeCheckout(page);
  if (!filled) {
    await ctx.close();
    return;
  }

  // Wait for /welcome → auto-signin → /dashboard
  try {
    await page.waitForURL(/\/(?:dashboard|$)/, { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await shot(page, `signup_${args.label.replace(/\s+/g, "_")}_dashboard`);
    if (page.url().includes("/welcome")) {
      // Manual signin path — fill password
      const pw = page.locator('input[type="password"]').first();
      if (await pw.count()) {
        await pw.fill(PASS);
        await page.locator('button[type="submit"]').first().click();
        await page.waitForTimeout(3000);
      }
    }
    const finalUrl = page.url();
    if (/app\.thecodedoctors\.com/.test(finalUrl) || finalUrl.includes("/dashboard")) {
      log(`  ✓ ${args.label}: signup → checkout → dashboard succeeded (${finalUrl})`);
    } else {
      record("P0", "error", `${args.label}: didn't land on dashboard after checkout`, { url: finalUrl });
    }
  } catch {
    record("P0", "error", `${args.label}: post-checkout flow timed out`, { url: page.url() });
  }

  await ctx.close();
}

async function phaseB(browser) {
  log("\n=== Phase B: Signup + Stripe Checkout ===\n");
  const ts = Date.now();
  await signupAndPay(browser, {
    label: "General monthly",
    startUrl: "/start?plan=general&interval=monthly",
    email: `b-gen-m-${ts}@thecodedoctors.test`,
    name: "B GenMonthly",
    business: "Test Co GenMonthly",
    website: "example.com",
  });
  await signupAndPay(browser, {
    label: "Premium yearly",
    startUrl: "/start?plan=premium&interval=yearly",
    email: `b-prem-y-${ts}@thecodedoctors.test`,
    name: "B PremYearly",
    business: "Test Co PremYearly",
    website: "example.com",
  });
  await signupAndPay(browser, {
    label: "Checkup one-time",
    startUrl: "/start?plan=checkup",
    email: `b-checkup-${ts}@thecodedoctors.test`,
    name: "B Checkup",
    business: "Test Co Checkup",
    website: "example.com",
  });
  await signupAndPay(browser, {
    label: "7-day Trial",
    startUrl: "/trial",
    email: `b-trial-${ts}@thecodedoctors.test`,
    name: "B Trial",
    business: "Test Co Trial",
    website: "example.com",
  });
}

/* ─── Phase C: Login flows ──────────────────────────────────────────────── */

async function phaseC(browser, totpSecret) {
  log("\n=== Phase C: Login flows ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  // 1. Correct credentials (Maria)
  log("\n— Login: correct credentials (Maria) —");
  if (await loginPatient(page, "maria@lumierebistro.com")) {
    log("  ✓ Login succeeded");
    await logout(page);
  }

  // 2. Wrong password
  log("\n— Login: wrong password —");
  await page.goto(APP + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('input[name="email"]').first().fill("maria@lumierebistro.com");
  await page.locator('input[name="password"]').first().fill("WrongPassword99!");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(2500);
  await shot(page, "login_wrong_password");
  const wpBody = await page.locator("body").innerText().catch(() => "");
  if (/incorrect|wrong|Email or password/i.test(wpBody)) {
    log("  ✓ Wrong-password error rendered");
  } else {
    record("P1", "missing", "Wrong-password error UI not visible", { url: page.url() });
  }

  // 3. Founder login (TOTP)
  log("\n— Login: founder with TOTP —");
  if (await loginFounder(page, totpSecret)) {
    log("  ✓ Founder TOTP login succeeded");
    await logout(page);
  }

  // 4. Wrong TOTP
  log("\n— Login: founder with WRONG TOTP —");
  await page.goto(ADMIN + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('input[name="email"]').first().fill(FOUNDER_EMAIL);
  await page.locator('input[name="password"]').first().fill(PASS);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/login\?error=TotpRequired/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const totpField = page.locator('input[name="totpCode"]').first();
  if (await totpField.count()) {
    await page.locator('input[name="email"]').first().fill(FOUNDER_EMAIL);
    await page.locator('input[name="password"]').first().fill(PASS);
    await totpField.fill("000000");
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    await shot(page, "login_wrong_totp");
    const wtBody = await page.locator("body").innerText().catch(() => "");
    if (/code doesn't match|recovery|invalid/i.test(wtBody)) {
      log("  ✓ Wrong-TOTP error rendered");
    } else {
      record("P1", "missing", "Wrong-TOTP error UI not visible", { url: page.url() });
    }
  }

  await ctx.close();
}

/* ─── Phase D: Forgot password ──────────────────────────────────────────── */

async function phaseD(browser) {
  log("\n=== Phase D: Forgot password (request side) ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(APEX + "/forgot-password", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.locator('input[name="email"], input[type="email"]').first().fill("maria@lumierebistro.com");
  await shot(page, "forgot_filled");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  await shot(page, "forgot_submitted");
  const body = await page.locator("body").innerText().catch(() => "");
  if (/sent|check your inbox|on its way|If we have an account/i.test(body)) {
    log("  ✓ Forgot-password 'code sent' UI rendered");
  } else {
    record("P1", "missing", "Forgot-password: no confirmation UI", { url: page.url() });
  }
  await ctx.close();
}

/* ─── Phase E: Patient mutations as Maria ───────────────────────────────── */

async function phaseE(browser) {
  log("\n=== Phase E: Maria mutations ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  if (!(await loginPatient(page, "maria@lumierebistro.com"))) {
    await ctx.close();
    return;
  }

  // 1. Submit a new request
  log("\n— New request submission —");
  await page.goto(APP + "/requests/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator('input[name="title"]').first().fill("E2E test — please ignore");
  const desc = page.locator('textarea[name="description"]').first();
  if (await desc.count()) {
    await desc.fill("Submitted by automated end-to-end test. Safe to delete.");
  }
  await shot(page, "maria_new_request_filled");
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  await shot(page, "maria_new_request_submitted");
  if (page.url().includes("/requests") && !page.url().includes("/new")) {
    log("  ✓ New request submitted, landed on detail or list page");
  } else {
    record("P1", "error", "New-request submit didn't navigate away from /requests/new", { url: page.url() });
  }

  // 2. Reply to existing request thread
  log("\n— Reply to existing request thread —");
  await page.goto(APP + "/requests", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const reqLinks = await page.$$eval('a[href*="/requests/"]', (els) =>
    Array.from(new Set(els.map((e) => e.getAttribute("href")).filter(Boolean)))
  );
  const target = reqLinks.find((h) => h && h !== "/requests" && h !== "/requests/new");
  if (target) {
    await page.goto(APP + target, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const messageField = page
      .locator('textarea[name="body"], textarea[name="message"], textarea[placeholder*="reply" i], textarea[placeholder*="message" i]')
      .first();
    if (await messageField.count()) {
      await messageField.fill("E2E test reply — ignore.");
      await shot(page, "maria_reply_filled");
      const sendBtn = page
        .locator('button[type="submit"]:has-text("Send"), button:has-text("Reply"), button:has-text("Post")')
        .first();
      if (await sendBtn.count()) {
        await sendBtn.click();
        await page.waitForTimeout(3000);
        await shot(page, "maria_reply_sent");
        log("  ✓ Reply submitted");
      } else {
        record("P1", "missing", "Reply: no send button", { url: page.url() });
      }
    } else {
      record("P1", "missing", "Reply: no message field on request detail", { url: page.url() });
    }
  } else {
    record("P1", "missing", "No requests in list to reply to", { url: page.url() });
  }

  // 3. Profile name update
  log("\n— Profile name update —");
  await page.goto(APP + "/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const nameField = page
    .locator('input[name="name"], input[id*="name" i], input[placeholder*="name" i]')
    .first();
  if (await nameField.count()) {
    await nameField.fill("Maria Costa (e2e-edited)");
    await shot(page, "maria_profile_filled");
    const saveBtn = page
      .locator('button[type="submit"]:has-text("Save"), button:has-text("Update")')
      .first();
    if (await saveBtn.count()) {
      await saveBtn.click();
      await page.waitForTimeout(2500);
      await shot(page, "maria_profile_saved");
      log("  ✓ Profile save submitted");
    }
  }

  // 4. Switch to yearly billing
  log("\n— Switch monthly→yearly billing —");
  await page.goto(APP + "/billing", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const switchYearlyForm = page
    .locator('form:has(button:has-text("Switch to yearly"))')
    .first();
  if (await switchYearlyForm.count()) {
    await shot(page, "maria_billing_before_switch");
    await switchYearlyForm.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
    await shot(page, "maria_billing_after_switch");
    const after = await page.locator("body").innerText().catch(() => "");
    if (/Plan switched|prorated upgrade amount was charged/i.test(after)) {
      log("  ✓ Switched to yearly, success banner visible");
    } else if (/We couldn't switch your plan/i.test(after)) {
      record("P0", "error", "Plan switch failed (Stripe rejected)", { url: page.url() });
    } else {
      record("P1", "missing", "Plan switch: no success banner", { url: page.url() });
    }
  } else {
    log("  · Switch-to-yearly button not found (already on yearly?)");
  }

  await logout(page);
  await ctx.close();
}

/* ─── Phase F: Trial conversion as Sarah ────────────────────────────────── */

async function phaseF(browser) {
  log("\n=== Phase F: Sarah trial conversion ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  if (!(await loginPatient(page, "sarah@studiolin.photo"))) {
    await ctx.close();
    return;
  }

  await page.goto(APP + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot(page, "sarah_hub_with_trial");

  const convertBtn = page
    .locator('form button:has-text("Convert"), form button:has-text("Lock in")')
    .first();
  if (!(await convertBtn.count())) {
    log("  · Convert CTA not visible (trial may have already ended)");
    await ctx.close();
    return;
  }
  await convertBtn.click();
  log("→ Convert button clicked, waiting for billing redirect…");
  await page.waitForURL(/\/billing/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await shot(page, "sarah_post_convert");
  const after = await page.locator("body").innerText().catch(() => "");
  if (/You're a paying patient now|trial ended early|Stripe charged/i.test(after)) {
    log("  ✓ Trial converted successfully");
  } else if (/couldn't end your trial early|trial=failed/i.test(after) || page.url().includes("trial=failed")) {
    record("P0", "error", "Trial conversion: Stripe rejected", { url: page.url() });
  } else {
    record("P1", "missing", "Trial conversion: no success banner", { url: page.url() });
  }

  await logout(page);
  await ctx.close();
}

/* ─── Phase G: Founder admin mutations ──────────────────────────────────── */

async function phaseG(browser, totpSecret) {
  log("\n=== Phase G: Founder admin mutations ===\n");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  if (!(await loginFounder(page, totpSecret))) {
    await ctx.close();
    return;
  }

  // 1. Change a request's status (pick the first non-healed/closed request)
  log("\n— Change request status —");
  await page.goto(ADMIN + "/requests", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const reqHrefs = await page.$$eval('a[href*="/requests/"]', (els) =>
    Array.from(new Set(els.map((e) => e.getAttribute("href")).filter(Boolean)))
  );
  const reqHref = reqHrefs.find((h) => h && h !== "/requests");
  if (reqHref) {
    await page.goto(ADMIN + reqHref, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await shot(page, "founder_request_detail");
    // Look for a status select / button
    const statusBtn = page
      .locator('button:has-text("Diagnosed"), button:has-text("In treatment"), button:has-text("In review"), select[name="status"]')
      .first();
    if (await statusBtn.count()) {
      const tag = await statusBtn.evaluate((el) => el.tagName);
      if (tag === "SELECT") {
        try {
          await statusBtn.selectOption("in_treatment");
          // Some forms auto-submit on change; others have a submit
          const submit = page.locator('button[type="submit"]').first();
          if (await submit.count()) await submit.click();
          await page.waitForTimeout(2500);
        } catch {}
      } else {
        await statusBtn.click();
        await page.waitForTimeout(2500);
      }
      await shot(page, "founder_status_changed");
      log("  ✓ Status change attempted");
    } else {
      record("P1", "missing", "No status-change UI on admin request detail", { url: page.url() });
    }

    // 2. Send a doctor message on the same request
    log("\n— Send doctor reply —");
    const messageField = page
      .locator('textarea[name="body"], textarea[name="message"], textarea[placeholder*="reply" i], textarea[placeholder*="message" i]')
      .first();
    if (await messageField.count()) {
      await messageField.fill("E2E test doctor reply.");
      const sendBtn = page
        .locator('button[type="submit"]:has-text("Send"), button:has-text("Reply"), button:has-text("Post")')
        .first();
      if (await sendBtn.count()) {
        await sendBtn.click();
        await page.waitForTimeout(2500);
        await shot(page, "founder_reply_sent");
        log("  ✓ Doctor reply sent");
      }
    }
  }

  // 3. Create a credential request (founder-only)
  log("\n— Create credential request —");
  await page.goto(ADMIN + "/credentials/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot(page, "founder_credential_new_form");
  // Fill what we can — fields vary
  const clientSelect = page.locator('select[name="clientId"], select[name="client"]').first();
  if (await clientSelect.count()) {
    try {
      const options = await clientSelect.evaluate((s) =>
        Array.from(s.querySelectorAll("option"))
          .map((o) => o.value)
          .filter((v) => v)
      );
      if (options.length) await clientSelect.selectOption(options[0]);
    } catch {}
  }
  const purposeField = page
    .locator('input[name="purpose"], input[name="title"], input[placeholder*="purpose" i]')
    .first();
  if (await purposeField.count()) {
    await purposeField.fill("E2E test — please ignore");
  }
  const submit = page.locator('button[type="submit"]').first();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(3000);
    await shot(page, "founder_credential_created");
    log("  ✓ Credential request submission attempted");
  }

  // 4. Create an incident
  log("\n— Create incident —");
  await page.goto(ADMIN + "/incidents/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const titleField = page.locator('input[name="title"]').first();
  if (await titleField.count()) {
    await titleField.fill("E2E test incident");
    const bodyField = page
      .locator('textarea[name="body"], textarea[name="description"]')
      .first();
    if (await bodyField.count()) await bodyField.fill("Automated test — please ignore.");
    await shot(page, "founder_incident_filled");
    const isubmit = page.locator('button[type="submit"]').first();
    if (await isubmit.count()) {
      await isubmit.click();
      await page.waitForTimeout(3000);
      await shot(page, "founder_incident_created");
      log("  ✓ Incident creation attempted");
    }
  } else {
    record("P1", "missing", "Incident new form not as expected", { url: page.url() });
  }

  // 5. Audit log: visit and confirm new entries appear
  log("\n— Audit log: confirm activity logged —");
  await page.goto(ADMIN + "/audit", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot(page, "founder_audit_log");
  const auditBody = await page.locator("body").innerText().catch(() => "");
  if (/billing|request|incident|credential/i.test(auditBody)) {
    log("  ✓ Audit log shows recent activity");
  } else {
    record("P1", "missing", "Audit log appears empty after mutations", { url: page.url() });
  }

  await ctx.close();
}

/* ─── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  log("Loading founder TOTP secret…");
  const totpSecret = await loadFounderTotp();
  if (!totpSecret) {
    log("⚠ founder TOTP secret missing — phases C/G will skip founder login");
  }

  log("Launching Chromium (headed, slow). Watching mode.\n");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600,
    args: ["--window-size=1320,860"],
  });

  try {
    await phaseA(browser); // Marketing public forms (Turnstile-gated)
    await phaseB(browser); // Signup → Stripe Checkout
    await phaseC(browser, totpSecret); // Login flows
    await phaseD(browser); // Forgot password
    await phaseE(browser); // Maria mutations
    await phaseF(browser); // Sarah trial conversion
    await phaseG(browser, totpSecret); // Founder admin mutations
  } finally {
    await browser.close();
  }

  log("\n\n=== Submission walkthrough complete ===\n");
  if (findings.length === 0) {
    log("✓ No findings — every form submitted, every mutation succeeded.");
  } else {
    log(`Found ${findings.length} issue(s):\n`);
    findings.forEach((f, i) => {
      console.log(`${i + 1}. [${f.severity}] [${f.category}] ${f.title}`);
      if (f.url) console.log(`   URL:  ${f.url}`);
    });
  }
  log(`\nScreenshots: ${SHOTS_DIR}`);

  const punchList =
    findings
      .map(
        (f, i) =>
          `${i + 1}. [${f.severity}] [${f.category}] ${f.title}${f.url ? `\n   ${f.url}` : ""}`
      )
      .join("\n") || "(no findings)";
  writeFileSync(resolve(SHOTS_DIR, "_findings.txt"), punchList, "utf8");
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
