# Build Log

Append-only record of what was built, decided, or changed each session.
Newest entries at the top. Every meaningful work session adds an entry.

Entry format:
```
## YYYY-MM-DD — Session title
**Built**: …
**Decided**: …
**Open**: …
**Next**: …
```

---

## 2026-05-01 — Phase 3 foundation: Drizzle schema, Auth.js wiring, portal route groups

**Why this session existed**: Founder asked about admin portals + customer logins. Phase 3 starts. This session is the foundation — schema, auth, route restructure, empty portal shells. Real CRUD features (request creation, Kanban, messaging) are next session.

**Built — data layer**:
- `drizzle.config.ts` — Drizzle Kit config pointing at `src/db/schema.ts`, migrations in `src/db/migrations`
- `src/db/schema.ts` — full Postgres schema:
  - 7 enums: `user_role`, `client_status`, `client_plan`, `request_status`, `request_priority`, `request_type`, `lead_source`
  - Auth.js core tables (table names per Drizzle adapter spec): `user`, `account`, `session`, `verificationToken`. The `user` table is extended with our own columns: `role` (enum), `totp_secret`, `totp_enabled`, `two_factor_required`, `last_login_at`, `created_at`. Auth.js ignores extra columns it doesn't know about.
  - Domain tables: `client` (organizations), `client_member` (M2M users↔clients), `request`, `message` (threaded per request, `internal` flag for staff-only notes), `file` (R2 keys), `audit_log` (append-only staff actions), `lead` (pre-conversion contacts with `(email, source)` unique index), `scan` (diagnostic-tool reports for follow-up)
  - Drizzle Relations declared so the Query Builder works
  - Type exports (`User`, `Client`, `Request`, etc) for app-wide type safety
- `src/db/index.ts` — lazy-cached `db()` client + `isDbConfigured()` helper. `prepare: false` for connection-pooled Postgres (Neon, Supabase).
- `src/lib/leads.ts` — refactored: writes to Postgres via Drizzle when `DATABASE_URL` is set, falls back to `data/leads.jsonl` otherwise. `onConflictDoNothing()` on the `(email, source)` unique index.

**Built — auth**:
- `src/auth.ts` — Auth.js v5 (next-auth@beta) with Drizzle adapter, Resend magic-link provider, database-strategy sessions. Custom `session` callback hydrates the user role + 2FA status from the DB row into `session.user`. Type augmentation in the same file extends `next-auth`'s `Session` and `User` types.
- `src/app/api/auth/[...nextauth]/route.ts` — Node-runtime handler exporting `GET`/`POST` from Auth.js.

**Built — route restructure**:
- Moved 11 marketing pages from `src/app/X/` to `src/app/(marketing)/X/` so portals can have their own layout chrome
- `src/app/layout.tsx` refactored to be minimal — only html/body/fonts/global providers (SmoothScroll, ViewTransitions). Per-surface chrome lives in route group layouts.
- `src/app/(marketing)/layout.tsx` — wraps with SiteHeader / SiteFooter
- `src/app/(portal)/layout.tsx` — auth-gates `/dashboard`, redirects staff to `/admin`, renders `PortalShell variant="client"`
- `src/app/(admin)/layout.tsx` — auth-gates `/admin`, redirects clients to `/dashboard`, renders `PortalShell variant="admin"`
- `src/components/portal-shell.tsx` — shared sticky top-bar with logo, nav (different items per variant), user info, sign-out (Server Action calling `signOut`). Teal accent for clients, signal-red for admin so the surface is unmistakable.
- `src/app/(portal)/dashboard/page.tsx` — empty-state client dashboard with three action cards (submit request, site health, message doctor) and an inviting empty state
- `src/app/(admin)/admin/page.tsx` — staff dashboard skeleton with 4-card stat grid + Phase 5 placeholder

**Built — login flow**:
- `src/app/login/page.tsx` — sign-in form. Server Action calls `signIn("resend", { email })`. Redirects logged-in users to their portal automatically. Shows a clear warning when `DATABASE_URL` is missing so dev doesn't get confused.
- `src/app/login/verify/page.tsx` — "check your inbox" landing page after magic-link request. In voice.

**Built — tooling**:
- npm scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`
- `.env.example` updated with `PSI_API_KEY` slot, comments on how to fill in `DATABASE_URL` and `AUTH_SECRET`

**Verified**:
- `npm run typecheck` clean · `npm run lint` clean · `npm run build` clean
- Routes correctly classified: 14 static (marketing + login/verify) + 6 dynamic (`/admin`, `/dashboard`, `/login`, `/api/auth/[...]`, `/api/checkup`, `/api/lead`)
- Dev server reloaded without errors after the route move

**Decided**:
- **Postgres + Drizzle now**, even though deploy isn't done — gets the lead store on real DB infrastructure ASAP and de-risks Phase 5. Marketing site keeps working without `DATABASE_URL` (file-based lead store fallback).
- **Single `/login` URL** — one form for both clients and staff. Role determines redirect target. Cleaner than `/admin/login` carve-out.
- **Path-based portal routing for v1** (`/dashboard`, `/admin`), subdomain routing layered on at deploy via Cloudflare Page Rules or middleware host rewrite. Avoids needing `app.localhost` DNS hacks during local dev.
- **2FA schema fields in place but flow deferred to Phase 5** — `totp_secret`, `totp_enabled`, `two_factor_required` are in the user table now so we don't need a migration later. The UI / verification step gets built when we tackle staff-side workflows in earnest.
- **Adapter cast in `src/auth.ts`** — Auth.js wants the adapter at the top level, but `db()` throws when `DATABASE_URL` isn't set. Used `isDbConfigured()` to gate the adapter so dev/build still works without a DB.

**Open**:
- Visual review of the new portals in browser (login → check inbox → dashboard) — but **needs a working `DATABASE_URL` first**, since Auth.js can't store a session without it. Founder must provision Neon (free tier) before testing the portal flow end-to-end.
- Subdomain routing wiring (Cloudflare side) — deferred to deploy
- TOTP UI/verification — Phase 5
- Migration generation — `npm run db:generate` will create the SQL once Neon URL is plugged in

**Next**:
- Founder either provisions Neon now (so we can test the auth flow) or keeps building portal features against the schema. The portal shell + auth gate are ready; next layer is **CRUD** — Submit-a-Request form, request list, individual request page with messaging.

---

## 2026-05-01 — Phase 2: live diagnostic tool end-to-end (lead magnet operational)

**Why this session existed**: Phase 2 is the lead magnet that makes the cold-outreach pitch land. Visitor enters a URL → instant audit → email-gated full report. Phase 2 is now functional locally; only deploy-side wiring remains.

**Built — server side**:
- `src/lib/checkup/url-validation.ts` — SSRF-hardened URL validation. Rejects: empty/long/invalid input, non-http(s) schemes, reserved hostnames (`localhost`, metadata.google.internal, etc), private TLDs (`.local`, `.internal`, etc), raw private IP literals (IPv4 & IPv6), and any DNS-resolved private/loopback/link-local/CGNAT/multicast/reserved IP. Includes 169.254.169.254 (AWS/GCP metadata), 100.64.0.0/10 (CGNAT), 192.0.2.0/24 (TEST-NET), all RFC1918, all IPv6 ULA/link-local/v4-mapped variants.
- `src/lib/checkup/fetcher.ts` — page fetcher with manual redirect handling (max 3 hops, each hop revalidated upstream by re-running validation), 8s timeout, 1MB body cap, controlled User-Agent.
- `src/lib/checkup/checks/transport.ts` — HTTPS / HSTS / preload eligibility / Server & X-Powered-By leakage.
- `src/lib/checkup/checks/security-headers.ts` — CSP, X-Content-Type-Options, X-Frame-Options (with CSP frame-ancestors substitution credit), Referrer-Policy, Permissions-Policy, COOP. Deducts for `unsafe-inline` / `unsafe-eval`.
- `src/lib/checkup/checks/seo.ts` — `<title>`, meta description, viewport, canonical, Open Graph, robots.txt + sitemap.xml HEAD probes.
- `src/lib/checkup/checks/dns.ts` — SPF, DMARC (with policy strictness check), CAA, MX presence; intelligent apex-domain detection for multi-label TLDs (co.uk, com.au, etc).
- `src/lib/checkup/checks/privacy.ts` — pattern-based detection of GA4/UA/Facebook Pixel/Hotjar/TikTok Pixel/LinkedIn Insight/Microsoft Clarity/GTM, plus cookie-banner cue detection and privacy-policy link detection.
- `src/lib/checkup/checks/performance.ts` — TTFB / page weight / compression / cache headers; layers in Google PageSpeed Insights API when `PSI_API_KEY` is set (60% PSI / 40% heuristic blend).
- `src/lib/checkup/scanner.ts` — orchestrator. Validates input, fetches the page, runs all 6 checks in parallel, computes weighted overall score (security-headers 25, transport 20, performance 20, seo 15, dns 15, privacy 5).
- `src/app/api/checkup/route.ts` — Node-runtime POST endpoint. Rate-limit → Turnstile verify → scan. Returns full report JSON or typed error.
- `src/app/api/lead/route.ts` — Node-runtime POST endpoint for email capture. Validates email, rate-limits, verifies Turnstile, persists lead, fires-and-forgets the report email.
- `src/lib/rate-limit.ts` — in-memory token bucket per client IP, with `clientKey()` helper that prefers `cf-connecting-ip` → `x-real-ip` → `x-forwarded-for`.
- `src/lib/turnstile.ts` — Cloudflare Turnstile server-side verifier. Pass-through when not configured; validates `cf-turnstile-response` against siteverify when `TURNSTILE_SECRET_KEY` set.
- `src/lib/leads.ts` — lead store abstraction with file-based fallback (`data/leads.jsonl`, gitignored). Drizzle/Postgres swap-in slot already marked for Phase 3.
- `src/lib/email.ts` — Resend integration with full HTML report render in brand voice. Logs to console when `RESEND_API_KEY` not set.

**Built — client side**:
- `src/components/diagnostic-tool.tsx` — interactive client component with state machine (`idle | scanning | results | error`). URL input form, animated scanning state (staggered phase indicators with pulse), error state in voice.
- `src/components/diagnostic-results.tsx` — animated results view: count-up overall score (motion `useMotionValue`/`animate`), 6 staggered check cards, expandable findings with severity-coloured icons (info/low/medium/high/critical), and email-gate sub-form posting to `/api/lead`.
- `src/app/checkup/page.tsx` — replaced static placeholder with the live tool.

**Verified end-to-end**:
- ✅ `npm run typecheck` clean · `npm run lint` clean · `npm run build` succeeds
- ✅ All 14 marketing routes still prerendered as `○ Static`; the two new API routes correctly marked `ƒ Dynamic`
- ✅ SSRF: localhost, 192.168.1.1, 169.254.169.254, "not a url", missing url — all rejected with typed error codes (private/invalid/url-required)
- ✅ Real scan against example.com: 745ms, overall 73/C, accurate breakdown (Headers 43/D — example.com really has none; DNS 94/A — SPF+DMARC present)
- ✅ Lead persists to `data/leads.jsonl` with email/url/source/ip/userAgent/meta/createdAt
- ✅ Rate limit returns HTTP 429 after the per-IP bucket is drained

**Decided**:
- **No real PDF in v1** — sending a styled HTML email containing every finding is enough for the lead-magnet pitch. PDF generation (with `@react-pdf/renderer` or print stylesheet) added to Phase 2 v2 backlog.
- **In-memory rate limiting is fine for launch volume** — single-instance deploys on Cloudflare Pages with low cold concurrency. Cluster-aware (Upstash/Redis) bucket arrives in Phase 5+ if/when traffic warrants.
- **File-based lead store** — avoids forcing a Postgres dep this turn. The interface is async + idempotent so swapping in Drizzle in Phase 3 is a one-file change.
- **Six checks, weighted toward security/performance** — matches our brand promise; trackers/SEO weighted lower because they're already heavily covered by competing tools and aren't our differentiator.
- **Hard 1MB body cap on fetched HTML** — prevents an obvious DoS vector where someone points the scanner at a 5GB chunked response.

**Open**:
- Founder visual review of the scan flow at http://localhost:3456/checkup — try a real domain (`https://stripe.com`, `https://nytimes.com`, your own client URLs) and tell me what feels off
- Need a `PSI_API_KEY` for real Lighthouse scores in the performance check (free up to 25k/day from Google Cloud Console). When set, the heuristic gives way to real Lighthouse data.
- Need `RESEND_API_KEY` + a verified `thecodedoctors.com` sending domain to actually deliver the report email
- Need `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` for production CAPTCHA protection — the server-side hook is wired; the front-end Turnstile widget add-in is small and lands when keys are set
- The CSP currently allows `connect-src 'self'` — when we deploy, this is correct for our own `/api/checkup` calls. If we move the scanner to a worker on a separate origin, CSP needs `connect-src` widening.

**Next**:
- Founder runs `npm run dev` and exercises `/checkup` in browser. Specifically: scan a few real URLs and report on (a) how the scanning animation feels, (b) whether the results reveal feels native-mobile, (c) whether the findings copy is right.
- Then: deploy push (Cloudflare Pages, GitHub repo, DNS) so the tool is reachable from the cold-outreach emails.

---

## 2026-05-01 — Phase 1 Day 2: native-app feel — Lenis smooth scroll, view transitions, scroll-driven reveals, card micro-interactions

**Why this session existed**: founder reviewed Day 1 output and said "site is decent but it has to really stand out — pages should feel like a native mobile app, smooth like butter." This session is the polish pass that addresses that.

**Built**:
- `src/components/smooth-scroll.tsx` — Lenis wrapper (`lerp 0.1`, `duration 1.1`, `smoothWheel`). Mounted in layout; hijacks the wheel for eased scrolling on desktop, leaves touch native. Skipped entirely under `prefers-reduced-motion`.
- `src/components/view-transitions.tsx` — global click interceptor that wraps every internal navigation in `document.startViewTransition()`. Custom implementation because React 19.2 stable does not export `ViewTransition` (only canary does); waits up to 1.5s for `location.pathname` to reflect the navigation before resolving the transition's promise so React has time to commit the new page before the snapshot. Falls through to plain Next navigation in browsers without `startViewTransition`.
- `globals.css` — view transition keyframes (`tcd-page-leave`, `tcd-page-enter`) with subtle blur + Y-translate for an iOS-feel crossfade; header pinned via `view-transition-name: site-header` so the spatial anchor stays put across page changes.
- `globals.css` — pure-CSS scroll-driven section reveals (`@supports (animation-timeline: view())`) — gentle fade-up as each section enters the viewport. Zero JS, falls back to immediate render in unsupported browsers.
- `globals.css` — `card-hover` utility (subtle lift + accent glow + transition timing) and `card-highlighted` utility (gradient halo on the recommended plan).
- `Section` primitive now applies `reveal` class by default (toggleable via `reveal={false}`).
- Hero and inline `<section>` elements (DiagnosticPreview, TrustStrip, FinalCTA) classed appropriately so the page's whole vertical flow reveals as the user scrolls.
- Treatment cards, plan cards, and patient story cards all switched to `card-hover` for the iOS-press feel on hover.
- Reduced-motion media query honoured at every animated layer (Lenis, view transitions, reveals, card hover).
- `experimental.viewTransition: true` set in `next.config.ts` so we can drop in React's `<ViewTransition>` immediately when stable React exposes it (currently the flag is recognised by Next but doesn't yet activate transitions on its own with React stable).

**Decided**:
- **Keep the multi-page structure** — earlier in the session I misread the founder's complaint and started collapsing /services /plans /stories /about into anchor sections on the home page. Founder clarified mid-stream: pages stay, but transitions between them must feel like a native mobile app. Reverted the deletions.
- **No React canary upgrade** — Next docs assume React canary for `<ViewTransition>` component, but our stable React 19.2.4 doesn't expose it. Built custom click-interception layer instead so we don't take an experimental React dep we didn't sign up for. Switch to React's native component when it lands in stable.
- **Sequential scroll-restoration handed to the browser** — earlier draft of `SmoothScroll` snapped to top on every pathname change; that's wrong for back-button nav (native apps restore previous scroll position). Removed; now relies on Next/browser default scroll restoration.
- **Card hover effect uses transform + glow rather than colour change** — colour-only hovers feel flat. The 2px lift + accent halo gives an iOS-card pressed-state feel.

**Verified**:
- `npm run build` succeeds; all 14 routes still prerendered as static
- `npm run typecheck` passes · `npm run lint` clean
- Curl confirms view-transition CSS rules ship in the served stylesheet
- Curl confirms `card-hover` (24×) and `reveal` (21×) classes present on home page DOM
- Dev compilation log clean after rebuild — zero errors after the fix

**Not yet verified (founder action)**:
- Visual feel of the cross-page transitions — whether the timing trick (waiting for pathname commit) gives crisp animations or any flicker
- Lenis smoothness on the founder's hardware — `lerp 0.1 / duration 1.1` is a reasonable default but may want tuning
- Scroll-driven reveals interaction with Lenis — `animation-timeline: view()` reads native scroll position which Lenis updates normally, but worth eyeballing
- Mobile feel — view transitions are supported in iOS Safari 18+ and Chrome Android, but needs in-hand check

**Open**:
- React canary upgrade decision — defer until we hit something that actually needs it; current custom approach works
- Scroll progress bar across top of page — proposed v3 polish, not built yet
- Active section indicator on long pages — only relevant once we have anchor-targeting nav, not needed for current multi-page setup
- Custom cursor — proposed Phase 7 polish

**Next**:
- Founder runs `npm run dev`, opens http://localhost:3456 (port 3000 is taken on this machine), and reviews the cross-page feel. Click around between Home → Services → Plans → Stories → About — should feel buttery, not jank.
- If transitions feel off, tune Lenis (`lerp`, `duration`) and view transition keyframes (`tcd-page-leave`/`tcd-page-enter` durations and easings)
- Cloudflare account / GitHub push / Pages deploy still pending; no progress this session

---

## 2026-05-01 — Phase 1 Day 1: marketing site scaffolded, all pages built, security headers verified

**Built**:
- Next.js 16.2.4 App Router project scaffolded with TypeScript strict, Tailwind v4, ESLint, src/ dir, App Router, `@/*` alias, Turbopack
- Git repo initialized on `main` branch (no remote yet)
- Brand theme tokens in `src/app/globals.css` — surgical teal accent (#3DD9D6) on deep ink (#0A0E13), Geist Sans + Geist Mono, EKG keyframe animations, accessible focus ring
- `next.config.ts` with full security header set: strict CSP, HSTS preload, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy (locked), COOP, CORP, X-DNS-Prefetch-Control off, `poweredByHeader: false`
- Site config in `src/lib/site.ts` (name, URL, tagline, nav, footer nav)
- `cn()` className utility in `src/lib/cn.ts` (clsx + tailwind-merge)
- UI primitives: `Button` (polymorphic for `<button>` or `<Link>`), `Section` + `SectionHeader`
- Layout: `SiteHeader` (sticky, glass blur, stethoscope mark), `SiteFooter` (4-column with security.txt mention and "All systems healthy" indicator)
- 11 home-page sections as separate components: Hero (CSS+SVG EKG, headline "Your website needs a doctor."), DiagnosticPreview (Phase 2 placeholder), ProblemStats, Treatments, HowItWorks, PlansSection, PatientStories, TrustStrip, FounderNote, FAQ, FinalCTA
- Pages: `/`, `/services`, `/plans`, `/stories`, `/checkup`, `/about`, `/book`, `/privacy`, `/terms`, `/security`, `/cookies`
- Special routes: `not-found.tsx` and `global-error.tsx` both written in brand voice
- `sitemap.ts` (auto-generates sitemap.xml from route list)
- `robots.ts` (auto-generates robots.txt with sitemap pointer)
- `public/.well-known/security.txt` with disclosure policy pointer
- `.nvmrc` (Node 24), `.editorconfig`, `.env.example` (full Phase 1–7 env shape)
- Removed default scaffold SVGs (next.svg, vercel.svg, etc.)
- Added `typecheck` npm script

**Verified**:
- `npm run build` succeeds; all 14 routes prerendered as static (`○ Static`)
- `npm run typecheck` passes
- `npm run lint` passes (zero warnings/errors)
- Booted prod server, curl confirmed all security headers present on `/` and on `/.well-known/security.txt`
- robots.txt and sitemap.xml respond correctly

**Decided**:
- **Next 16, not 15** — scaffold installed 16.2.4 (latest); we adapt to new conventions: `proxy.ts` (replaces `middleware.ts`), async `headers()`/`cookies()`, Tailwind v4 `@theme` blocks (no `tailwind.config.ts`)
- **CSP without nonces for marketing site** — keeps static rendering for Lighthouse 100. Allow `'unsafe-inline'` only for `style-src` (Next/Tailwind require it). Strict everything else. Nonces will be layered in for portal pages in Phase 3 via `proxy.ts`.
- **Three.js / R3F deferred to Phase 7** — pure CSS+SVG EKG hero for v1 keeps JS bundle tiny and Lighthouse 100 achievable. WebGL adds weight that hurts performance score.
- **shadcn/ui deferred** — building Tailwind primitives directly works for v1 (only ~3 primitives needed). Reconsider for Phase 3 portal where we'll need more components (data tables, dialogs, command menu, etc).
- **Lucide is on v1.x major series** — that's the legitimate latest, not a typo. Verified the package.

**Open**:
- 2 moderate npm-audit findings are transitive postcss inside Next itself; the only "fix" downgrades Next from 16 to 9.3.3 — unacceptable. We document and wait for Next to bump postcss.
- Visual QA in a real browser still needed before Phase 1 can be called done — request founder check
- Logo / wordmark still not designed — currently using stethoscope icon from Lucide as the mark
- Cloudflare deployment, DNS, DMARC/SPF/DKIM, Plausible self-host all still pending
- Auth.js (Phase 3) will require switching to nonce-based CSP — plan a follow-up ADR when that lands

**Next**:
- Founder spins up `npm run dev`, opens http://localhost:3000, reviews polish and gives feedback
- Whatever copy/visual changes founder requests
- Begin Cloudflare account setup, push repo to GitHub, connect Cloudflare Pages
- After deploy: run Mozilla Observatory + SSL Labs + Lighthouse, capture screenshots, paste scores into ROADMAP

---

## 2026-05-01 — Project context system established

**Built**:
- `CLAUDE.md` at project root — auto-loaded master context for every future session
- `docs/ROADMAP.md` — 7-phase build plan with status checkboxes; source of truth for "what's done"
- `docs/ARCHITECTURE.md` — locked-in stack, infra, three-surface architecture, repo layout
- `docs/BRAND.md` — voice & tone, vocabulary system, palette/typography direction
- `docs/SECURITY-POSTURE.md` — non-negotiable security checklist (TLS, headers, DNS, edge, auth, app, data, audit)
- `docs/decisions/0001-initial-stack-and-infra.md` — first ADR locking in stack & infra choices
- `docs/BUILD-LOG.md` — this file

**Decided** (from founder Q&A):
- **Full build** committed (8–12 weeks across 7 phases) — but we still ship phased, with marketing site live in week 1–2
- **Industry-agnostic at launch** — niche later once we see who converts
- **Subdomains**: `app.` and `admin.` (not paths)
- **Cloudflare end-to-end** for hosting (Pages + Workers + R2 + WAF + Turnstile + DDoS) — single security story we can sell
- **Team of 5 doctors** at launch — staff portal designed for 5-person practice with role-based access

**Open**:
- Logo design / wordmark — not started
- Final accent color: surgical teal (#3DD9D6) or signal red — leaning teal but founder confirms in Phase 1
- Whether to internally call clients "Patients" — recommend "Client" externally, "Patient" never reaches the UI
- Whether status page is its own surface or a route on marketing site

**Next**:
- Scaffold the Next.js 15 project (Phase 1 first item)
- Configure Tailwind, shadcn/ui, Lenis, Framer Motion
- Wire Cloudflare Pages deployment with custom domain
- Build security headers config FIRST so every later page inherits correct posture
