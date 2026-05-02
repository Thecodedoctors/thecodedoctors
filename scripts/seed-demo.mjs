/**
 * Seed the Neon database with a realistic-looking clinic so the admin
 * portal has something substantive to look at. Idempotent: re-running
 * is a no-op once the marker client ("Lumière Bistro") exists.
 *
 * Run via: node scripts/seed-demo.mjs
 */

import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

// ── env loader (tiny, just for DATABASE_URL) ──────────────────────────────
const envText = fs.readFileSync(".env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
}

const sql = neon(process.env.DATABASE_URL);

// ── PBKDF2 hashing (matches src/lib/password.ts) ──────────────────────────
const ITER = 100_000;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    km,
    32 * 8
  );
  const b64 = (u) => Buffer.from(u).toString("base64");
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(new Uint8Array(bits))}`;
}

const PASSWORD = "Patient1234!";

const CLIENTS = [
  {
    slug: "lumiere",
    name: "Lumière Bistro",
    plan: "general",
    status: "active",
    websiteUrl: "https://lumierebistro.com",
    contactName: "Maria Costa",
    contactEmail: "maria@lumierebistro.com",
    note: "Bistro — online ordering critical Friday/Saturday nights.",
    siteDown: true,
  },
  {
    slug: "pinewood",
    name: "Pinewood Dental",
    plan: "premium",
    status: "active",
    websiteUrl: "https://pinewooddental.com",
    contactName: "Dr. Sarah Lee",
    contactEmail: "drlee@pinewooddental.com",
    note: "Dental — HIPAA-aware. New patient form is the main lead source.",
  },
  {
    slug: "northwind",
    name: "Northwind Realty",
    plan: "general",
    status: "active",
    websiteUrl: "https://northwindrealty.com",
    contactName: "Marcus Holt",
    contactEmail: "marcus@northwindrealty.com",
    note: "Realty — MLS feed, weekly listing imports.",
  },
  {
    slug: "greenhouse",
    name: "The Greenhouse Studio",
    plan: "general",
    status: "active",
    websiteUrl: "https://greenhousestudio.co",
    contactName: "Iris Park",
    contactEmail: "iris@greenhousestudio.co",
    note: "Design studio — portfolio-heavy, Cloudinary-backed.",
  },
  {
    slug: "bayside",
    name: "Bayside Yoga",
    plan: "checkup",
    status: "lead",
    websiteUrl: "https://baysideyoga.com",
    contactName: "Rae Singh",
    contactEmail: "rae@baysideyoga.com",
    note: "Lead from free checkup — needs nudge to convert.",
  },
  {
    slug: "steelanvil",
    name: "Steel Anvil Gym",
    plan: "premium",
    status: "active",
    websiteUrl: "https://steelanvilgym.com",
    contactName: "Tony Vasquez",
    contactEmail: "tony@steelanvilgym.com",
    note: "Gym — class booking + Stripe subscriptions on the line.",
  },
  {
    slug: "pacifica",
    name: "Pacifica Coffee Roasters",
    plan: "general",
    status: "active",
    websiteUrl: "https://pacificaroasters.com",
    contactName: "Emi Kobayashi",
    contactEmail: "emi@pacificaroasters.com",
    note: "DTC coffee — Shopify shell, custom subscription page.",
  },
  {
    slug: "cascade",
    name: "Cascade Veterinary",
    plan: "premium",
    status: "active",
    websiteUrl: "https://cascadevet.com",
    contactName: "Dr. Brennan Walsh",
    contactEmail: "drbrennan@cascadevet.com",
    note: "Vet clinic — appointment booking + emergency banner.",
  },
];

// Each request: { title, description, type, priority, status, archivedAt?, messages: [{author: 'client'|'staff'|'staff_internal', body, ageDays}] }
const REQUESTS_BY_SLUG = {
  lumiere: [
    {
      title: "Online ordering broken on iPhone Safari",
      description:
        "Friday night rush hit and the cart is freezing on checkout for ~30% of Apple users. Toast lookup loops. Need this looked at urgently — every minute is a lost order.",
      type: "bug",
      priority: "urgent",
      status: "in_treatment",
      ageDays: 0,
      messages: [
        {
          author: "client",
          ageDays: 0,
          body: "Just had three customers DM us that the checkout button doesn't do anything on iPhone. Working fine on Android. Help!",
        },
        {
          author: "staff",
          ageDays: 0,
          body: "On it — pulling logs now. Looks like the new gift-card field is throwing on Safari's stricter input parser. Hotfix going out within 30 min.",
        },
        {
          author: "staff_internal",
          ageDays: 0,
          body: "Toast bug + Safari 17.5 — same combo as the Lakeshore client last month. Patching the same way.",
        },
      ],
    },
    {
      title: "Reservation page Lighthouse score dropped to 64",
      description:
        "Got a Lighthouse alert this morning that the reservations page is at 64. We were at 96 last week. Did something change?",
      type: "performance",
      priority: "high",
      status: "diagnosed",
      ageDays: 1,
      messages: [
        {
          author: "client",
          ageDays: 1,
          body: "Lighthouse dropped 30 points overnight on /reservations. Anything you can see?",
        },
        {
          author: "staff",
          ageDays: 1,
          body: "Found it — your last menu update added a 4MB hero PNG. Compressing + serving WebP. Will be back to 95+ today.",
        },
      ],
    },
    {
      title: "Weekly menu PDF won't open on some phones",
      description: "Customers report 'corrupted' PDF when downloading the weekly menu.",
      type: "bug",
      priority: "medium",
      status: "healed",
      ageDays: 5,
      messages: [
        {
          author: "client",
          ageDays: 5,
          body: "Several guests said the menu PDF won't open. Older Androids mostly.",
        },
        {
          author: "staff",
          ageDays: 4,
          body: "PDF was being served with the wrong MIME type via the new CDN config. Fixed at the worker level — try downloading again.",
        },
        {
          author: "client",
          ageDays: 4,
          body: "Confirmed working — thank you!",
        },
      ],
    },
  ],
  pinewood: [
    {
      title: "New-patient form not sending intake email",
      description:
        "Forms are submitting (we see the records in the dashboard) but the staff notification email is never arriving. Started ~3 days ago.",
      type: "bug",
      priority: "high",
      status: "in_review",
      ageDays: 2,
      messages: [
        {
          author: "client",
          ageDays: 2,
          body: "Front desk noticed they haven't gotten a single new-patient email since Tuesday. Submissions are still going through though.",
        },
        {
          author: "staff",
          ageDays: 1,
          body: "DKIM key rotated last week broke the SPF chain — fixed and re-verified. Triggered a test submission. Confirm one came through?",
        },
        {
          author: "client",
          ageDays: 1,
          body: "Got it. Reviewing now — will close once we see one in real traffic.",
        },
      ],
    },
    {
      title: "Add Google reviews carousel to homepage",
      description:
        "Could you add a strip of recent Google reviews above the fold? Like what Lumière Bistro has.",
      type: "improvement",
      priority: "low",
      status: "triaged",
      ageDays: 0,
      messages: [
        {
          author: "client",
          ageDays: 0,
          body: "Saw Lumière's homepage and loved their reviews carousel. Could we get something similar?",
        },
      ],
    },
  ],
  northwind: [
    {
      title: "MLS feed import failing every Tuesday",
      description:
        "The IDX feed import has been silently failing every Tuesday morning for the last month. Our listings are 7 days stale on average now.",
      type: "bug",
      priority: "high",
      status: "in_treatment",
      ageDays: 1,
      messages: [
        {
          author: "client",
          ageDays: 1,
          body: "Tuesday's import failed again. Agents are pulling listings off competitor sites instead of ours.",
        },
        {
          author: "staff",
          ageDays: 1,
          body: "Looked at logs — IDX provider raised their daily rate limit but our cron still runs at peak. Moving import to 3am Mountain. Should land tonight.",
        },
      ],
    },
    {
      title: "Property search filters slow on mobile",
      description: "Filtering by price range takes 8+ seconds on a phone.",
      type: "performance",
      priority: "medium",
      status: "in_review",
      ageDays: 4,
      messages: [
        {
          author: "client",
          ageDays: 4,
          body: "Search on mobile is painfully slow. Desktop is fine.",
        },
        {
          author: "staff",
          ageDays: 2,
          body: "Added an index on the price column + moved the filter to a server component. Mobile is now ~600ms. Take a look and let me know if it's good to close.",
        },
      ],
    },
    {
      title: "SSL certificate auto-renew",
      description: "Set up automatic renewal so the cert never expires by surprise.",
      type: "security",
      priority: "low",
      status: "healed",
      ageDays: 12,
      messages: [
        {
          author: "client",
          ageDays: 12,
          body: "Last year the cert expired and the site went down for a day. Can we set up auto-renew?",
        },
        {
          author: "staff",
          ageDays: 11,
          body: "Wired up via Cloudflare's universal SSL — renewal is fully automatic now. No action ever needed on your side.",
        },
      ],
    },
  ],
  greenhouse: [
    {
      title: "Add case-study post type to CMS",
      description: "Want to publish detailed case studies separately from the regular project gallery.",
      type: "improvement",
      priority: "medium",
      status: "in_treatment",
      ageDays: 3,
      messages: [
        {
          author: "client",
          ageDays: 3,
          body: "We've got 3 case studies ready to ship. Need a content type for them — long-form, with hero, problem/solution sections, and pull quotes.",
        },
        {
          author: "staff",
          ageDays: 2,
          body: "Schema's drafted. Sending you a Figma preview tomorrow before we build the template.",
        },
      ],
    },
    {
      title: "Image gallery sometimes shows broken thumbnails",
      description: "Maybe 1 in 20 page loads a few thumbs are blank. Refresh fixes it.",
      type: "bug",
      priority: "medium",
      status: "diagnosed",
      ageDays: 2,
      messages: [
        {
          author: "client",
          ageDays: 2,
          body: "Random broken thumbnails. Hard to repro but it happens.",
        },
        {
          author: "staff",
          ageDays: 1,
          body: "Reproduced. Cloudinary is occasionally rate-limiting our edge cache fills. Fix is to pre-warm the cache nightly. Patch ready, deploying tomorrow.",
        },
      ],
    },
  ],
  bayside: [
    {
      title: "Free checkup follow-up",
      description:
        "Lead from the free checkup tool — site scored 67/100. Three priority issues: missing CSP, slow LCP on hero, no DKIM on email.",
      type: "other",
      priority: "low",
      status: "triaged",
      ageDays: 6,
      messages: [
        {
          author: "client",
          ageDays: 6,
          body: "Saw your tool flagged some things. Curious what the General Care plan would cover for us.",
        },
      ],
    },
  ],
  steelanvil: [
    {
      title: "Stripe subscription cancel flow broken",
      description:
        "Members trying to cancel are seeing a generic error on the final step. Stripe webhooks are firing fine, just the success page is broken.",
      type: "bug",
      priority: "high",
      status: "in_treatment",
      ageDays: 1,
      messages: [
        {
          author: "client",
          ageDays: 1,
          body: "Member just called to cancel because the cancel page errors out. Embarrassing.",
        },
        {
          author: "staff",
          ageDays: 0,
          body: "The redirect URL in the new Stripe portal config has a stale path. Two-line fix, deploying now.",
        },
      ],
    },
    {
      title: "Class schedule timezone bug",
      description: "Schedule shows as Pacific time even for users in Mountain time.",
      type: "bug",
      priority: "medium",
      status: "healed",
      ageDays: 8,
      messages: [
        {
          author: "client",
          ageDays: 8,
          body: "Mountain-time members keep showing up an hour early. Schedule is hardcoded PT.",
        },
        {
          author: "staff",
          ageDays: 7,
          body: "Switched to user-local rendering. Confirmed across PT, MT, CT, ET. Good to close.",
        },
        { author: "client", ageDays: 7, body: "Working — thanks!" },
      ],
    },
  ],
  pacifica: [
    {
      title: "Subscription page checkout not working in Safari",
      description:
        "Apple users can't complete the subscription signup. Card form rejects valid cards.",
      type: "bug",
      priority: "high",
      status: "in_review",
      ageDays: 2,
      messages: [
        {
          author: "client",
          ageDays: 2,
          body: "We're losing about 15% of subscription signups — all Safari. Card form keeps saying 'invalid card.'",
        },
        {
          author: "staff",
          ageDays: 1,
          body: "Stripe Elements wasn't loading properly behind our Cloudflare worker. Added the missing CSP origin and redeployed. Test from a Mac and let me know.",
        },
      ],
    },
    {
      title: "Add 'gift a subscription' option",
      description: "Customers want to gift coffee subscriptions for the holidays.",
      type: "improvement",
      priority: "low",
      status: "triaged",
      ageDays: 2,
      messages: [
        {
          author: "client",
          ageDays: 2,
          body: "Lots of ask for gift subscriptions ahead of the holidays. Could we add this in the next month?",
        },
      ],
    },
  ],
  cascade: [
    {
      title: "Emergency banner shouldn't link to closed page",
      description:
        "The 'after-hours emergency' banner links to a 404 on weekends. Owners are panicking.",
      type: "bug",
      priority: "urgent",
      status: "healed",
      ageDays: 3,
      messages: [
        {
          author: "client",
          ageDays: 3,
          body: "Got an angry voicemail from a pet owner who clicked the emergency banner Saturday and hit a 404. THIS IS BAD.",
        },
        {
          author: "staff",
          ageDays: 3,
          body: "Found it — the page slug got changed during the May redesign and the banner kept the old URL. Fixed and tested 5 ways. Won't happen again.",
        },
        { author: "client", ageDays: 3, body: "Thank you. Closed." },
      ],
    },
    {
      title: "Audit accessibility for ADA compliance",
      description: "Considering a quarterly accessibility audit. Can we add this to General Care?",
      type: "improvement",
      priority: "low",
      status: "diagnosed",
      ageDays: 2,
      messages: [
        {
          author: "client",
          ageDays: 2,
          body: "Wondering what an ADA audit looks like and what it'd cost. Vet boards are pushing for this.",
        },
        {
          author: "staff",
          ageDays: 2,
          body: "Yes — we run quarterly Axe + manual audits as part of Premium. I'll send a sample report and a quote add-on for General.",
        },
      ],
    },
  ],
};

// ── helpers ───────────────────────────────────────────────────────────────
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function findFounderUserId() {
  const rows = await sql`select id from "user" where role = 'founder' limit 1`;
  return rows[0]?.id ?? null;
}

// ── main seed ─────────────────────────────────────────────────────────────
async function main() {
  // Idempotency check
  const marker = await sql`select 1 from "client" where name = 'Lumière Bistro' limit 1`;
  if (marker.length > 0) {
    console.log("Demo data already seeded. Re-run after deleting these clients to reseed.");
    return;
  }

  const founderId = await findFounderUserId();
  if (!founderId) {
    console.error("No founder user found — promote someone to founder first.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(PASSWORD);

  for (const c of CLIENTS) {
    console.log(`Seeding ${c.name}…`);

    // 1. Patient user
    const userRows = await sql`
      insert into "user" (id, email, name, role, password_hash, "emailVerified", created_at)
      values (gen_random_uuid()::text, ${c.contactEmail}, ${c.contactName}, 'client', ${passwordHash}, ${daysAgo(30)}, ${daysAgo(30)})
      on conflict (email) do update set name = excluded.name
      returning id
    `;
    const userId = userRows[0].id;

    // 2. Client row
    const clientRows = await sql`
      insert into "client" (id, name, status, plan, website_url, primary_user_id, notes, created_at, updated_at)
      values (gen_random_uuid()::text, ${c.name}, ${c.status}, ${c.plan}, ${c.websiteUrl}, ${userId}, ${c.note}, ${daysAgo(30)}, ${daysAgo(1)})
      returning id
    `;
    const clientId = clientRows[0].id;

    // 3. client_member link
    await sql`
      insert into client_member (client_id, user_id, is_admin, created_at)
      values (${clientId}, ${userId}, true, ${daysAgo(30)})
    `;

    // 4. Requests + messages
    const reqDefs = REQUESTS_BY_SLUG[c.slug] ?? [];
    for (const r of reqDefs) {
      const createdAt = daysAgo(r.ageDays + 1);
      const updatedAt = daysAgo(Math.max(0, r.ageDays - 1));
      const assignedTo =
        r.status === "triaged" ? null : founderId;
      const reqRows = await sql`
        insert into request (id, client_id, submitted_by_user_id, assigned_doctor_id, title, description, url, type, priority, status, created_at, updated_at)
        values (gen_random_uuid()::text, ${clientId}, ${userId}, ${assignedTo}, ${r.title}, ${r.description}, ${c.websiteUrl}, ${r.type}, ${r.priority}, ${r.status}, ${createdAt}, ${updatedAt})
        returning id
      `;
      const requestId = reqRows[0].id;

      // Messages
      for (const m of r.messages) {
        const authorId = m.author === "client" ? userId : founderId;
        const internal = m.author === "staff_internal";
        await sql`
          insert into message (id, request_id, author_user_id, body, internal, created_at)
          values (gen_random_uuid()::text, ${requestId}, ${authorId}, ${m.body}, ${internal}, ${daysAgo(m.ageDays)})
        `;
      }

      // Audit entry for status changes other than triaged
      if (r.status !== "triaged") {
        await sql`
          insert into audit_log (id, actor_user_id, action, target_type, target_id, before, after, ip, user_agent, ts)
          values (gen_random_uuid()::text, ${founderId}, 'request.update_status', 'request', ${requestId}, ${JSON.stringify({ status: "triaged" })}, ${JSON.stringify({ status: r.status })}, '127.0.0.1', 'TheCodeDoctors-Seed/1.0', ${updatedAt})
        `;
      }
      if (r.status === "healed") {
        await sql`
          insert into audit_log (id, actor_user_id, action, target_type, target_id, ip, user_agent, ts)
          values (gen_random_uuid()::text, ${userId}, 'request.approved', 'request', ${requestId}, '127.0.0.1', 'TheCodeDoctors-Seed/1.0', ${updatedAt})
        `;
      }
    }

    // 5. Health checks — ~12 over the last 3 days. Lumière flips to down on the last 3.
    for (let i = 0; i < 12; i++) {
      const checkedAt = new Date(Date.now() - i * 6 * 60 * 60 * 1000); // every 6h
      const isDownTick = c.siteDown && i < 3;
      const ok = !isDownTick;
      const responseMs = ok
        ? 180 + Math.floor(Math.random() * 220)
        : null;
      const statusCode = ok ? 200 : null;
      const error = ok ? null : "Connection refused";
      await sql`
        insert into health_check (id, client_id, url, ok, status_code, response_time_ms, error, checked_at)
        values (gen_random_uuid()::text, ${clientId}, ${c.websiteUrl}, ${ok}, ${statusCode}, ${responseMs}, ${error}, ${checkedAt})
      `;
    }
  }

  // 6. A handful of leads (some converted, some not)
  const leads = [
    { email: "ops@stillwaterspa.com", url: "https://stillwaterspa.com", source: "checkup" },
    { email: "info@tannerlaw.com", url: "https://tannerlaw.com", source: "book" },
    { email: "hello@meridiandental.com", url: "https://meridiandental.com", source: "checkup" },
    { email: "contact@harborsidebooks.com", url: "https://harborsidebooks.com", source: "newsletter" },
  ];
  for (const l of leads) {
    await sql`
      insert into lead (id, email, url, source, ip, user_agent, created_at)
      values (gen_random_uuid()::text, ${l.email}, ${l.url}, ${l.source}, '127.0.0.1', 'Mozilla/5.0', ${daysAgo(Math.floor(Math.random() * 14) + 1)})
      on conflict do nothing
    `;
  }

  console.log("\n✓ Demo data seeded.\n");
  const counts = await sql`
    select
      (select count(*) from "client") as clients,
      (select count(*) from "user" where role = 'client') as patients,
      (select count(*) from request) as requests,
      (select count(*) from message) as messages,
      (select count(*) from health_check) as health_checks,
      (select count(*) from audit_log) as audit_entries,
      (select count(*) from lead) as leads
  `;
  console.log("Totals now:", counts[0]);
  console.log(
    `\nAll seeded patient accounts use password: ${PASSWORD}\n` +
      `Sign in as any of them to see their POV. Lumière Bistro is currently DOWN — ` +
      `the admin home should show the red Fleet Alert strip.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
