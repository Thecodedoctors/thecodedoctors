# Architecture

The locked-in technical decisions for The Code Doctors platform.
Captured 2026-05-01. Material changes require a new ADR in `docs/decisions/`.

## Three surfaces, one codebase

```
                  ┌─────────────────────────┐
                  │      Cloudflare         │
                  │   (DNS · WAF · DDoS)    │
                  └──────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────────┐  ┌──────────────────┐
│ thecode-     │    │ app.thecode-     │  │ admin.thecode-   │
│ doctors.com  │    │ doctors.com      │  │ doctors.com      │
│ (marketing)  │    │ (client portal)  │  │ (staff portal)   │
└──────────────┘    └──────────────────┘  └──────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ▼
              ┌─────────────────────────────┐
              │   Next.js 15 (App Router)   │
              │   monorepo, route groups    │
              └──────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌─────────┐         ┌──────────┐        ┌──────────┐
   │ Neon DB │         │  R2      │        │  Stripe  │
   │ Postgres│         │ uploads  │        │  billing │
   └─────────┘         └──────────┘        └──────────┘
```

We use Next.js **route groups** so all three surfaces share components, types, and
auth in one repo, but render at different subdomains via middleware host-based routing.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Single repo for all surfaces · React Server Components keep TTFB fast · best ecosystem |
| Language | **TypeScript strict** | Non-negotiable; no `any` allowed in production code |
| Styling | **Tailwind CSS** | Apple-tier polish needs precise spacing/typography control |
| Components | **shadcn/ui** | Owned components, accessible, themeable, no dependency lock-in |
| Animation | **Framer Motion + Lenis** | Motion for UI; Lenis for buttery scroll |
| 3D / WebGL | **Three.js + React Three Fiber** | Hero EKG, ambient effects |
| Database | **Postgres on Neon** | Serverless, branchable per PR, fast cold starts |
| ORM | **Drizzle** | Type-safe, fast, no runtime overhead, simpler than Prisma at our scale |
| Auth | **Auth.js** + Postgres | Full control, no vendor lock-in (matters because we sell security) |
| 2FA | **TOTP** via Auth.js · **mandatory for staff**, optional for clients |
| File storage | **Cloudflare R2** | S3-compatible, zero egress fees, edge-cached |
| Real-time | **Pusher Channels** (v1), revisit Ably or self-hosted later | Lower-friction than self-hosting WebSockets at v1 |
| Payments | **Stripe** | Subscriptions + invoices + customer portal out of box |
| Email | **Resend** | React Email templates, great deliverability, simple API |
| Analytics | **Plausible (self-hosted)** | Cookie-free, GDPR-clean, privacy-credible — supports our brand |
| Error tracking | **Sentry** | Source maps stay private, alerting, performance |
| Uptime | **Better Stack** | For client health dashboards (Phase 6) |
| Hosting | **Cloudflare Pages + Workers** | End-to-end Cloudflare = single security story we can sell |
| WAF / DDoS | **Cloudflare** | Free tier covers launch volume |
| Bot mitigation | **Cloudflare Turnstile** | Free, no puzzles, CAPTCHA-better UX |

## Domain wiring

- `thecodedoctors.com` — public marketing site (Cloudflare Pages, fully static where possible)
- `app.thecodedoctors.com` — client portal (Cloudflare Pages + Workers; SSR where needed)
- `admin.thecodedoctors.com` — staff portal (same; behind WAF rule restricting access patterns)
- `status.thecodedoctors.com` — public status page (Phase 7)
- `*.thecodedoctors.com` SSL via Cloudflare universal cert
- DNS: managed in Cloudflare; **DNSSEC enabled**, **CAA records** locked to Cloudflare's CAs

## Repo layout (target)

```
TheCodeDoctors/
├── apps/
│   └── web/                     # Next.js app, all three surfaces
│       ├── app/
│       │   ├── (marketing)/     # routes for thecodedoctors.com
│       │   ├── (client)/        # routes for app.thecodedoctors.com
│       │   └── (admin)/         # routes for admin.thecodedoctors.com
│       ├── components/
│       ├── lib/
│       └── middleware.ts        # host-based routing
├── packages/
│   ├── db/                      # Drizzle schema + migrations
│   ├── ui/                      # shared component primitives (atop shadcn)
│   └── config/                  # shared eslint, tsconfig, tailwind
├── docs/                        # this folder
└── CLAUDE.md
```

We start as a single Next.js app and only split to a monorepo if/when warranted.
For v1: keep it one app with route groups. Don't pre-optimize.

## Key cross-cutting concerns

- **Auth state** flows through Server Components; client-side auth checks are belt-and-suspenders only
- **All mutations** are Server Actions (no client-side `fetch` to internal APIs)
- **Audit logging** wraps every staff-portal mutation: `(actor, action, target, before, after, ts)` written to an append-only table
- **Rate limiting** applied at Cloudflare edge (per IP) AND in-app (per user) for sensitive actions
- **Secrets** in Cloudflare environment variables; never in repo. `.env.example` shows shape only
- **No third-party JS** in the marketing site without Subresource Integrity hashes
