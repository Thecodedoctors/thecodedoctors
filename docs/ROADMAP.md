# Roadmap

Phased build of The Code Doctors platform.
Status: ⏳ pending · 🚧 in progress · ✅ complete · ⏸ paused

Total v1 estimate: **8–12 weeks** of focused work.
We tick boxes as we ship. This file is the source of truth for "what's done."

---

## Phase 1 — Public marketing site (Week 1–2)
**Goal**: a live, beautiful, secure site we can send cold-outreach prospects to this month.

> **Stack note**: scaffold installed Next.js **16.2.4** (newer than original plan which said 15) with Tailwind v4. We adapted: `proxy.ts` will be used in place of `middleware.ts` for portal phases, `headers()`/`cookies()` are async, Tailwind v4 theming is via `@theme` blocks in CSS instead of `tailwind.config.ts`. See `docs/decisions/0002-next16-tailwindv4.md` (to be written when next change requires it).

### Setup
- ✅ Next.js 16.2 App Router project scaffolded (TypeScript strict)
- ✅ Tailwind v4 installed + brand theme configured via `@theme` in `globals.css`
- ✅ `motion` (rebranded framer-motion) + Lenis installed (used in later phases)
- ⏸ Three.js / React Three Fiber — **deferred to Phase 7** (CSS+SVG EKG used for v1 to keep Lighthouse 100; WebGL adds JS weight that hurts performance score)
- ⏸ shadcn/ui — **deferred**, building primitives directly atop Tailwind for v1 (button, section). Reconsider when portal needs more (Phase 3).
- ⏳ Cloudflare Pages deployment connected to repo
- ⏳ Custom domain `thecodedoctors.com` wired with SSL

### Pages & sections
- ✅ `/` Home — Header, Hero (CSS+SVG EKG), Diagnostic preview, Problem stats, Treatments, How It Works, Plans, Patient Stories, Trust Strip, Founder note, FAQ, Final CTA, Footer
- ✅ `/services` Services
- ✅ `/plans` Pricing
- ✅ `/stories` Patient Stories
- ✅ `/checkup` Free Checkup landing (full tool in Phase 2)
- ✅ `/about` About + practice principles
- ✅ `/book` Contact / Book a Doctor
- ✅ `/privacy`, `/terms`, `/security`, `/cookies` legal
- ✅ `/.well-known/security.txt`
- ✅ `/sitemap.xml` and `/robots.txt`
- ✅ `not-found.tsx` (404 in brand voice) and `global-error.tsx` (in brand voice)

### Security & infra (Phase 1 must achieve this baseline)
- ✅ Strict CSP via `next.config.ts` headers (no `unsafe-inline` for scripts; `'unsafe-inline'` allowed only for styles to keep static rendering — nonces layered in for portal in Phase 3 via `proxy.ts`)
- ✅ HSTS with preload directive set (formal preload submission pending live deploy)
- ✅ X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy locked, COOP same-origin, CORP same-origin, X-DNS-Prefetch-Control off
- ✅ X-Powered-By stripped (`poweredByHeader: false`)
- ✅ Build passes: 14 routes, all statically prerendered
- ✅ TypeScript strict passes · ESLint clean
- ⏳ HTTPS only — pending Cloudflare deploy
- ⏳ DNSSEC enabled · CAA records — pending Cloudflare DNS
- ⏳ SPF + DKIM + DMARC — pending Cloudflare DNS + Resend setup
- ⏳ Mozilla Observatory A+ · SSL Labs A+ — pending live deploy verification
- ⏳ Plausible analytics (cookie-free) — pending self-hosted setup
- ⏳ Lighthouse 100 — pending live deploy verification

### Acceptance criteria for shipping Phase 1
- ⏳ All four Lighthouse scores 100 on home page (pending deploy)
- ⏳ Mozilla Observatory A+ (pending deploy)
- ⏳ SSL Labs A+ (pending deploy)
- ⏳ Mobile-perfect on iPhone SE width and up (pending visual QA in browser)
- ⏳ Founder reviews and explicitly approves design polish

---

## Phase 2 — Live diagnostic tool (Week 3)
**Goal**: the lead magnet. Visitor enters URL → instant audit → email-gated report.

- ✅ Serverless scanner — Next.js Route Handler `/api/checkup` (Node runtime). Six checks run in parallel: transport/TLS, security headers, SEO, DNS posture, privacy/trackers, performance.
- ✅ SSRF protection: hostname-and-IP allowlist; private/loopback/link-local/CGNAT/multicast/reserved IPv4 + IPv6 all rejected; AWS/GCP metadata IP blocked; raw IP literals checked; reserved hostnames blocked; private TLDs blocked; manual redirect handling caps at 3 hops with re-validation each hop
- ✅ Rate limit per IP — in-memory token bucket (6 req/min for `/api/checkup`, 4/5min for `/api/lead`). Cloudflare WAF rules layered on at deploy.
- ✅ Cloudflare Turnstile server-side verifier wired (`src/lib/turnstile.ts`); pass-through when key not set, validates when set
- ✅ Animated "diagnosing" state — staggered scanning steps, EKG pulse
- ✅ Animated results reveal — score count-up, staggered check cards, expandable findings, severity-coloured icons
- ✅ Email gate — `/api/lead` POST endpoint with email validation, rate limit, Turnstile verification, lead persistence
- ✅ Resend integration for the report email — `src/lib/email.ts` renders an in-voice HTML report with all findings; sends via Resend when `RESEND_API_KEY` is set, logs to console otherwise
- ✅ Lead captured — file-based fallback (`data/leads.jsonl`, gitignored) until Phase 3 wires Postgres + Drizzle
- ⏳ Real PDF generation — currently sends rich HTML; PDF (via `@react-pdf/renderer` or print stylesheet) lands in v2
- ⏳ Postgres + Drizzle persistence (deferred to Phase 3 — the file-based fallback works for launch volume)
- ⏳ Optional: Google PageSpeed Insights API for Lighthouse-grade performance numbers — wire-up in `performance.ts` is ready; just needs `PSI_API_KEY` env var

### Acceptance criteria for shipping Phase 2
- ✅ Real public URLs scan cleanly end-to-end (verified against example.com: 745ms, accurate findings)
- ✅ All known SSRF vectors blocked at validation (verified: localhost, 192.168.x, 169.254.169.254, raw IPs, reserved hostnames)
- ✅ Rate limit returns 429 when exceeded (verified)
- ✅ Lead persistence verified (file write confirmed)
- ⏳ Live deploy verification — CSP needs widening for the fetch + worker, Resend domain verified, Turnstile keys set
- ⏳ Founder UX review of the scan/results flow in browser

---

## Phase 3 — Auth + Client Portal v1 (Week 4–6)
**Goal**: clients can sign up, submit requests, track status, message us.

### Foundation (built 2026-05-01)
- ✅ Drizzle ORM + comprehensive Postgres schema (`src/db/schema.ts`) — Auth.js core tables (user/account/session/verificationToken) + domain tables (clients, client_members, requests, messages, files, audit_log, leads, scans) + 7 enums for roles/statuses/priorities. Indexes on every column we'll query by.
- ✅ Drizzle config + `npm run db:generate / db:migrate / db:push / db:studio`
- ✅ Lazy DB client (`src/db/index.ts`) with `isDbConfigured()` helper for graceful degradation
- ✅ Auth.js v5 (next-auth@beta) wired to Drizzle, magic-link sign-in via Resend, role-aware session augmentation
- ✅ Lead store (`src/lib/leads.ts`) refactored to use Postgres when `DATABASE_URL` is set, file fallback otherwise — with `ON CONFLICT DO NOTHING` to dedupe on (email, source)
- ✅ Route restructure into route groups: `(marketing)` (public site), `(portal)` (client portal), `(admin)` (staff portal). Marketing keeps the SiteHeader/Footer shell; portals get their own. Login page is in the bare global layout.
- ✅ Auth-gated layouts on `(portal)` and `(admin)` — reroute clients out of `/admin` and staff out of `/dashboard`
- ✅ `/login` page (magic-link form), `/login/verify` page (check-your-inbox)
- ✅ `/dashboard` empty client home with action cards + empty state
- ✅ `/admin` empty staff home with stats grid skeleton
- ✅ `PortalShell` component (sticky top bar, nav, sign-out form action) — variant for client (teal) vs admin (red)
- ✅ Build passes: 14 static + 6 dynamic routes; typecheck + lint clean

### To build (next sessions)
- ⏳ Submit-a-Request form (title, description, URL, screenshots, priority, type)
- ⏳ Kanban-style request tracker (Triaged / Diagnosed / In Treatment / In Review / Healed)
- ⏳ In-app messaging per request (real-time via Pusher or SSE)
- ⏳ Cloudflare R2 for file uploads
- ⏳ Notifications: in-app + email
- ⏳ Knowledge base v1 (markdown-rendered articles)
- ⏳ Subdomain routing — `app.thecodedoctors.com` and `admin.thecodedoctors.com` (deferred to deploy; locally we use `/dashboard` and `/admin` paths)
- ⏳ TOTP 2FA for staff — schema columns are in place (`totp_secret`, `totp_enabled`, `two_factor_required`); UI flow + OTP-step in middleware lands in Phase 5
- ⏳ Onboarding flow when a lead converts to a client (creates `clients` row, `clientMembers` row)

---

## Phase 4 — Stripe + plans (Week 7)
**Goal**: clients can subscribe to a plan and self-serve their billing.

- ⏳ Stripe products + prices for The Checkup, General Care, Premium Care, Emergency Surgery
- ⏳ Subscription checkout via Stripe Checkout
- ⏳ Customer portal (cancel, upgrade, update payment method)
- ⏳ Webhooks: subscription.updated, invoice.paid, invoice.failed
- ⏳ Plan-gated portal features (only paying clients get certain views)

---

## Phase 5 — Staff Portal v1 (Week 8–9)
**Goal**: the 5 doctors can run the entire business from one place.

- ⏳ `admin.thecodedoctors.com` subdomain wired
- ⏳ Mandatory 2FA on staff accounts (TOTP)
- ⏳ Role-based access: Founder · Senior Doctor · Doctor · Read-only
- ⏳ Universal inbox of all client requests, filterable
- ⏳ Drag-to-assign workflow with ETAs
- ⏳ Internal vs. client-visible notes per request
- ⏳ Time tracking per request
- ⏳ Client CRM (list view, plan, MRR, lifetime value, last contact)
- ⏳ Audit log of every staff action (immutable, append-only)
- ⏳ Billing controls: issue invoice, refund, manual charge, change plan

---

## Phase 6 — Site Health Dashboards (Week 10–11)
**Goal**: clients see their site's health live; staff sees the whole fleet at a glance.

- ⏳ Lighthouse-over-time graph per client site
- ⏳ Uptime monitoring integration (Better Stack or UptimeRobot)
- ⏳ Security grade tracker (re-runs Mozilla Observatory weekly)
- ⏳ SSL certificate expiry alerts
- ⏳ Per-client dashboard view
- ⏳ Fleet view in staff portal (red/amber/green grid)

---

## Phase 7 — Polish + WebGL + wow-moments (Week 12)
**Goal**: the differentiators that make people screenshot the site.

- ⏳ Three.js EKG/heartbeat hero with cursor reactivity
- ⏳ View Transitions API between pages
- ⏳ Custom cursor with subtle interactions
- ⏳ Live activity ticker in footer
- ⏳ Real-time global counter on hero ("Threats blocked today: …")
- ⏳ Public status page at `status.thecodedoctors.com`
- ⏳ Heartbeat Easter egg sound (toggleable, off by default)

---

## Phase 8+ — Ongoing
- ⏳ Blog / Resources for SEO
- ⏳ Referral program with reward tracking
- ⏳ Industry-specific landing pages (once we know who converts)
- ⏳ SMS notifications
- ⏳ Mobile app (only if data justifies it — don't pre-build)
