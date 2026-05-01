# ADR 0001 — Initial stack and infrastructure

- **Date**: 2026-05-01
- **Status**: Accepted
- **Decided by**: Founder (Precious) + Claude (Code Doctors AI consultant)

## Context

The Code Doctors needs a multi-surface platform: public marketing site, client portal,
and staff portal. The brand sells web quality and security, so the stack itself must:

1. Run blazingly fast (Lighthouse 100 across the board)
2. Carry a credible security story we can point to in sales
3. Support real-time interactions (chat, request status updates) by Phase 3
4. Stay maintainable by a 5-person team
5. Avoid vendor lock-in where it would cost us credibility

## Decision

### Frontend & app
- **Next.js 15 App Router** (TypeScript strict)
- **Tailwind + shadcn/ui** for styling and component primitives
- **Framer Motion + Lenis** for animation and smooth scroll
- **Three.js + React Three Fiber** for the WebGL hero and ambient effects

### Data
- **Postgres on Neon** (serverless, branchable per PR)
- **Drizzle ORM** (type-safe, lightweight)
- **Cloudflare R2** for file storage (S3-compatible, no egress fees)

### Auth & payments
- **Auth.js** with Postgres adapter, mandatory TOTP 2FA for staff
- **Stripe** for subscriptions and invoicing

### Infra & edge
- **Cloudflare end-to-end**: Pages (hosting), Workers (edge functions), WAF, Turnstile, DDoS, DNS
- **DNSSEC** + **CAA** locked to Cloudflare CAs

### Observability & ops
- **Sentry** for errors (with PII scrubbing)
- **Plausible** (self-hosted) for analytics — cookie-free
- **Better Stack** for uptime monitoring (used in Phase 6 client dashboards)
- **Resend** for transactional email

### Real-time
- **Pusher Channels** for v1 (client portal chat, status updates)
- Revisit Ably or self-hosted later if pricing or features warrant

### Domains
- `thecodedoctors.com` — marketing
- `app.thecodedoctors.com` — client portal
- `admin.thecodedoctors.com` — staff portal
- `status.thecodedoctors.com` — public status page (Phase 7)

## Alternatives considered

- **Astro for marketing + separate Next.js for app**: cleaner separation but doubles
  the maintenance surface. Single Next.js with route groups wins for a 5-person team.
- **Supabase instead of Neon + Auth.js**: faster start but bundles auth, storage, DB,
  and realtime in a way that becomes hard to swap. Owning each piece matters when we
  sell security — we want to point at our specific configurations.
- **Vercel instead of Cloudflare**: Vercel's DX is best-in-class but the **single-vendor
  security story** ("we run on Cloudflare end-to-end with WAF, DDoS, and bot management
  built in") is too valuable for our brand to give up.
- **Prisma instead of Drizzle**: more mature tooling but heavier runtime. Drizzle's
  closer-to-SQL approach fits a security-conscious team better.
- **Clerk instead of Auth.js**: zero-config wins, but vendor-lock-in conflicts with
  our brand (we are the people who own and harden their own stack).

## Consequences

**Positive**:
- One repo, one team, one vendor for the edge → simpler ops
- Clear, defensible "this is how we secure things" story for sales
- Type safety end-to-end (DB → server → client)
- Lighthouse 100 achievable from day one with Next.js + Cloudflare Pages

**Negative / risks**:
- Cloudflare lock-in for hosting. Mitigation: Next.js itself is portable; we can move
  to Vercel/AWS in days if Cloudflare ever fails us.
- Pusher pricing scales with connections. Mitigation: we re-evaluate at Phase 6 when
  we have actual usage data.
- Auth.js requires more wiring than Clerk. Acceptable: the control matters more.

## Review trigger

Revisit this ADR if:
- Cloudflare materially raises prices or limits us
- We exceed 100k monthly active users (different scale dynamics apply)
- A team member has serious case for swapping a piece — file a new ADR
