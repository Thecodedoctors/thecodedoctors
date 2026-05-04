#!/usr/bin/env node
/**
 * Seed five varied test patients with realistic data — different plans,
 * billing cadences, request loads, message threads, notifications.
 *
 * Run AFTER `node scripts/cleanup-test-accounts.mjs`. Idempotent-ish:
 * if a user with the same email already exists, that persona is skipped.
 *
 * Personas:
 *   1. Maria Costa       — Lumière Bistro              · Premium monthly  · 3 requests
 *   2. James Park        — Park & Co Architects        · Premium yearly   · 2 requests, custom build inquiry
 *   3. Sarah Lin         — Studio Lin Photography      · General trial    · 1 request, freshly signed up
 *   4. David Tran        — Tran Auto Body              · General yearly   · 4 requests, varied statuses
 *   5. Olivia Chen       — Olivia Chen Photography     · Checkup-only     · 1 closed audit
 *
 * All passwords: Doctor1234!
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

/* ─── PBKDF2 password hashing — mirrors src/lib/password.ts ─────────────── */

const ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const PASSWORD = "Doctor1234!";

function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_BYTES * 8
  );
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

/* ─── Persona definitions ──────────────────────────────────────────────── */

const personas = [
  {
    email: "maria@lumierebistro.com",
    userName: "Maria Costa",
    businessName: "Lumière Bistro",
    websiteUrl: "https://lumierebistro.com",
    plan: "premium",
    interval: "monthly",
    /** "active" = real Stripe sub charged; "trialing" = trial period;
     *  "checkup" = one-time payment, no recurring. */
    billing: "active",
    requests: [
      {
        title: "Christmas hours banner on homepage",
        description:
          "Need a dismissible banner showing our holiday hours from Dec 23–26. Should auto-hide after Dec 27.",
        type: "improvement",
        priority: "medium",
        status: "triaged",
        messages: [],
      },
      {
        title: "Add OpenTable reservation widget",
        description:
          "Embed the OpenTable widget on /reservations and the homepage hero. We have an account already.",
        type: "improvement",
        priority: "high",
        status: "in_treatment",
        messages: [
          { from: "client", body: "Here's our OpenTable RID: 12345 — let me know if you need login." },
          { from: "doctor", body: "Got it — we'll have the widget on /reservations by Friday and a homepage CTA next Monday." },
          { from: "client", body: "Perfect, thank you." },
        ],
      },
      {
        title: "Update menu PDF on /menu page",
        description: "Spring menu live; please replace the linked PDF and refresh the og:image preview too.",
        type: "improvement",
        priority: "medium",
        status: "healed",
        messages: [
          { from: "client", body: "Attached the new PDF." },
          { from: "doctor", body: "Updated. The og:image was generating from a stale Cloudflare cache — purged it. Should be live everywhere now." },
        ],
      },
    ],
    notifications: [
      { eventKey: "request.message_received", title: "New message from your doctor", body: "OpenTable widget — going live Friday.", href: "/requests" },
      { eventKey: "request.status_changed", title: "Request healed", body: "Update menu PDF on /menu page", href: "/requests" },
      { eventKey: "billing.activated", title: "You're active", body: "Premium Care is live.", href: "/billing" },
    ],
  },
  {
    email: "james@parkco.studio",
    userName: "James Park",
    businessName: "Park & Co Architects",
    websiteUrl: "https://parkco.studio",
    plan: "premium",
    interval: "yearly",
    billing: "active",
    requests: [
      {
        title: "iOS app for the project gallery",
        description:
          "We'd love a native iOS app that mirrors our public project gallery — pinch-to-zoom, AR preview of selected renderings. Curious what you'd quote.",
        type: "other",
        priority: "low",
        status: "triaged",
        messages: [
          { from: "client", body: "No deadline — exploring whether this is feasible inside our retainer or if it's a custom build." },
          { from: "doctor", body: "Native iOS is custom-build territory — we'll scope it and send a proposal. Premium plan covers the discovery work, just not the implementation." },
        ],
      },
      {
        title: "Migrate from WordPress to Next.js",
        description: "Considering the rebuild we discussed last quarter. What does the timeline look like if we start in May?",
        type: "redesign",
        priority: "medium",
        status: "in_review",
        messages: [
          { from: "doctor", body: "Sent the full discovery doc — 6-8 weeks for the rebuild + 2 weeks of QA. Want a video walkthrough?" },
        ],
      },
    ],
    notifications: [
      { eventKey: "billing.upgraded", title: "Switched to yearly", body: "You're now on Premium Care yearly. 15% saved.", href: "/billing" },
    ],
  },
  {
    email: "sarah@studiolin.photo",
    userName: "Sarah Lin",
    businessName: "Studio Lin Photography",
    websiteUrl: "https://studiolin.photo",
    plan: "general",
    interval: "monthly",
    billing: "trialing",
    requests: [
      {
        title: "Set up booking calendar on /book",
        description: "Currently using a Google Form which is ugly. Want a nice calendar that matches the brand. Squarespace-y feel.",
        type: "improvement",
        priority: "medium",
        status: "triaged",
        messages: [],
      },
    ],
    notifications: [
      { eventKey: "billing.activated", title: "Free trial started", body: "7 days of General Care, on us. Card on file but not charged yet.", href: "/billing" },
    ],
  },
  {
    email: "david@tranautobody.com",
    userName: "David Tran",
    businessName: "Tran Auto Body",
    websiteUrl: "https://tranautobody.com",
    plan: "general",
    interval: "yearly",
    billing: "active",
    requests: [
      {
        title: "Mobile menu broken on iOS Safari",
        description: "Hamburger menu doesn't open on iPhone — works fine on Android. Started after the last theme update.",
        type: "bug",
        priority: "high",
        status: "in_treatment",
        messages: [
          { from: "client", body: "Customer just emailed me about it — bumping priority." },
          { from: "doctor", body: "Confirmed on iOS Safari 17. It's a CSS z-index regression from the theme update. Pushing a fix in the next hour." },
        ],
      },
      {
        title: "Add online quote request form",
        description: "Right now people email or call. Want a form on /quote that captures vehicle info + photos and emails the shop manager.",
        type: "improvement",
        priority: "medium",
        status: "triaged",
        messages: [],
      },
      {
        title: "Page speed too slow on /services",
        description: "Lighthouse score is 47. Customers complain it's slow on mobile.",
        type: "performance",
        priority: "high",
        status: "diagnosed",
        messages: [
          { from: "doctor", body: "Diagnosed: 4.2MB hero video on /services is the killer. Plan: lazy-load, replace with a poster-image-fallback for low-bandwidth, and serve WebM. Should hit Lighthouse 85+." },
        ],
      },
      {
        title: "Add Yelp + Google Reviews widget",
        description: "Want the latest 5-star reviews on the homepage.",
        type: "improvement",
        priority: "low",
        status: "healed",
        messages: [
          { from: "doctor", body: "Live on the homepage now. Pulls top 6 reviews, refreshes daily." },
        ],
      },
    ],
    notifications: [
      { eventKey: "request.status_changed", title: "Mobile menu — in treatment", body: "We're on it.", href: "/requests" },
      { eventKey: "request.diagnosed", title: "Page speed — diagnosed", body: "Plan ready, see the request thread.", href: "/requests" },
    ],
  },
  {
    email: "olivia@oliviachen.studio",
    userName: "Olivia Chen",
    businessName: "Olivia Chen Photography",
    websiteUrl: "https://oliviachen.studio",
    plan: "checkup",
    interval: "monthly",
    billing: "checkup",
    requests: [
      {
        title: "The Checkup — comprehensive site audit",
        description: "Deep audit covering performance, SEO, security, accessibility, mobile, DNS posture. Plus 3 page-level mockups.",
        type: "other",
        priority: "medium",
        status: "healed",
        messages: [
          { from: "doctor", body: "Report delivered — 23 pages, 3 mockups for /portfolio, /contact, and /about. Top finding: your DNS is on a free Cloudflare plan but your site isn't actually proxied (orange cloud is off). Fix that first; everything else is downstream." },
          { from: "client", body: "Thank you — switched it on, saw the speed improvement immediately. Considering ongoing care." },
        ],
      },
    ],
    notifications: [
      { eventKey: "checkup.delivered", title: "Your Checkup is ready", body: "23-page report + 3 mockups attached.", href: "/requests" },
    ],
  },
];

/* ─── Stripe helpers ──────────────────────────────────────────────────── */

function priceIdFor(plan, interval) {
  if (plan === "premium") {
    return interval === "yearly" ? env.STRIPE_PRICE_PREMIUM_YEARLY : env.STRIPE_PRICE_PREMIUM;
  }
  return interval === "yearly" ? env.STRIPE_PRICE_GENERAL_YEARLY : env.STRIPE_PRICE_GENERAL;
}

async function createStripeSubscription({ email, name, plan, interval, trialDays }) {
  const customer = await stripe.customers.create({
    email,
    name,
    description: `Seeded test patient — ${name}`,
  });

  // Attach a test payment method so renewals + upgrades work later.
  // pm_card_visa is Stripe's universal test PM; safe to attach + use.
  const pm = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: pm.id },
  });

  const priceId = priceIdFor(plan, interval);
  const sub = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: priceId }],
    default_payment_method: pm.id,
    ...(trialDays ? { trial_period_days: trialDays } : {}),
    metadata: { seeded: "true" },
    expand: ["items.data"],
  });

  return { customer, sub, priceId };
}

async function createStripeCustomerOnly({ email, name }) {
  // Checkup is a one-time purchase — we just need the Stripe customer
  // record so future invoices/cards work; no subscription, no historical
  // invoice. Skipping the invoice creation since the API shape changed
  // in 2026 (price → pricing) and it isn't load-bearing for the seed.
  const customer = await stripe.customers.create({
    email,
    name,
    description: `Seeded test patient — ${name} (Checkup only)`,
  });
  return { customer };
}

/* ─── DB inserts ──────────────────────────────────────────────────────── */

async function findFounderId() {
  const rows = await sql`SELECT id FROM "user" WHERE role = 'founder' LIMIT 1`;
  return rows[0]?.id ?? null;
}

async function seedPersona(p, founderId) {
  const existing = await sql`SELECT id FROM "user" WHERE email = ${p.email}`;
  if (existing.length > 0) {
    console.log(`  · ${p.email} already exists — skipping`);
    return;
  }

  console.log(`\n→ ${p.userName}  (${p.email})`);
  const passwordHash = await hashPassword(PASSWORD);

  // The Drizzle schema uses `$defaultFn(() => crypto.randomUUID())` for
  // every primary key, which only fires on Drizzle inserts — not raw
  // SQL. Generate the IDs here so the NOT NULL constraint passes.
  const userId = crypto.randomUUID();

  await sql`
    INSERT INTO "user" (id, name, email, password_hash, role)
    VALUES (${userId}, ${p.userName}, ${p.email}, ${passwordHash}, 'client')
  `;

  // Stripe side first so we have the customer/sub IDs to insert with.
  let customerId = null;
  let subscriptionId = null;
  let priceId = null;
  let periodEnd = null;
  let mrrCents = 0;
  let trialEndsAt = null;
  let stripePlan = p.plan;
  let stripeStatus = "active";

  if (p.billing === "active") {
    const { customer, sub, priceId: pid } = await createStripeSubscription({
      email: p.email,
      name: p.businessName,
      plan: p.plan,
      interval: p.interval,
    });
    customerId = customer.id;
    subscriptionId = sub.id;
    priceId = pid;
    const item = sub.items.data[0];
    const periodEndUnix = item?.current_period_end ?? sub.current_period_end ?? null;
    periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
    const billed = item?.price.unit_amount ?? 0;
    mrrCents = p.interval === "yearly" ? Math.round(billed / 12) : billed;
    console.log(`  ✓ Stripe sub ${sub.id} · period_end ${periodEnd?.toISOString().slice(0, 10) ?? "?"}`);
  } else if (p.billing === "trialing") {
    const { customer, sub, priceId: pid } = await createStripeSubscription({
      email: p.email,
      name: p.businessName,
      plan: p.plan,
      interval: p.interval,
      trialDays: 7,
    });
    customerId = customer.id;
    subscriptionId = sub.id;
    priceId = pid;
    const item = sub.items.data[0];
    const periodEndUnix = item?.current_period_end ?? sub.current_period_end ?? null;
    periodEnd = periodEndUnix ? new Date(periodEndUnix * 1000) : null;
    trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
    const billed = item?.price.unit_amount ?? 0;
    mrrCents = 0; // trial = no MRR yet
    stripeStatus = "active"; // we still mark them active so they can use the portal
    console.log(`  ✓ Trial sub ${sub.id} · trial ends ${trialEndsAt?.toISOString().slice(0, 10) ?? "?"}`);
  } else if (p.billing === "checkup") {
    const { customer } = await createStripeCustomerOnly({
      email: p.email,
      name: p.businessName,
    });
    customerId = customer.id;
    stripePlan = "checkup";
    console.log(`  ✓ Checkup customer ${customer.id}`);
  }

  const clientId = crypto.randomUUID();
  await sql`
    INSERT INTO client (
      id, name, website_url, primary_user_id, plan, status,
      signup_source, stripe_customer_id, stripe_subscription_id, stripe_price_id,
      current_period_end, trial_ends_at, mrr_cents,
      lead_doctor_id
    )
    VALUES (
      ${clientId}, ${p.businessName}, ${p.websiteUrl}, ${userId}, ${stripePlan}, ${stripeStatus},
      ${p.billing === "trialing" ? "trial" : p.billing === "checkup" ? "checkup" : "plan"},
      ${customerId}, ${subscriptionId}, ${priceId},
      ${periodEnd}, ${trialEndsAt}, ${mrrCents},
      ${founderId}
    )
  `;
  console.log(`  ✓ client ${clientId}`);

  // client_member: user is admin of their client.
  await sql`
    INSERT INTO client_member (client_id, user_id, is_admin)
    VALUES (${clientId}, ${userId}, true)
  `;

  // Requests + messages.
  for (const r of p.requests) {
    const requestId = crypto.randomUUID();
    await sql`
      INSERT INTO request (
        id, client_id, submitted_by_user_id, assigned_doctor_id, title, description,
        url, type, priority, status
      )
      VALUES (
        ${requestId}, ${clientId}, ${userId}, ${founderId}, ${r.title}, ${r.description},
        ${p.websiteUrl}, ${r.type}, ${r.priority}, ${r.status}
      )
    `;
    for (const m of r.messages) {
      const authorId = m.from === "client" ? userId : founderId;
      await sql`
        INSERT INTO message (id, request_id, author_user_id, body, internal)
        VALUES (${crypto.randomUUID()}, ${requestId}, ${authorId}, ${m.body}, false)
      `;
    }
  }
  console.log(`  ✓ ${p.requests.length} request(s) + messages`);

  // Notifications.
  for (const n of p.notifications) {
    await sql`
      INSERT INTO notification (id, user_id, event_key, title, body, href)
      VALUES (${crypto.randomUUID()}, ${userId}, ${n.eventKey}, ${n.title}, ${n.body}, ${n.href})
    `;
  }
  console.log(`  ✓ ${p.notifications.length} notification(s)`);
}

async function main() {
  const founderId = await findFounderId();
  if (!founderId) {
    console.error("No founder user found — refusing to seed.");
    process.exit(1);
  }
  console.log(`Seeding 5 personas. Founder ID: ${founderId}`);

  for (const p of personas) {
    try {
      await seedPersona(p, founderId);
    } catch (err) {
      console.error(`\n  ✗ ${p.email} failed:`, err.message);
      if (err.raw) console.error("    raw:", JSON.stringify(err.raw, null, 2));
    }
  }

  console.log("\n────────────────────────────────────────────────────");
  console.log("Login credentials (all use password Doctor1234!):");
  for (const p of personas) {
    console.log(`  ${p.email}`);
  }
  console.log("────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\nFAILED:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
