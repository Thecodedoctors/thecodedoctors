# The Code Doctors

Your website needs a doctor. We diagnose, prescribe, treat, and maintain.

Live at **[thecodedoctors.com](https://thecodedoctors.com)** — a website health/maintenance SaaS built entirely around a clinical diagnostic framework (checkup → diagnosis → treatment plan), with real paying customers.

Built and directed solo by a medical doctor (MBBS) transitioning into health-tech product and engineering — see [`docs/BRAND.md`](./docs/BRAND.md) for the reasoning behind the clinical framing, and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the technical decisions.

This repository contains the full multi-surface platform: public marketing site, client portal, and staff portal.

> **For AI agents** — read [`CLAUDE.md`](./CLAUDE.md) and [`docs/ROADMAP.md`](./docs/ROADMAP.md) at the start of every session. The `docs/` folder is the source of truth for project state, decisions, and security posture.

## Status

Phase 1 in progress: public marketing site is scaffolded, all routes built, all security headers in place. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full plan.

## Stack

Next.js 16 · TypeScript · Tailwind v4 · `motion` · Lenis · Postgres on Neon · Drizzle · Auth.js · Cloudflare Pages/Workers/R2/WAF/Turnstile · Stripe · Resend · Plausible · Sentry. Full rationale in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run typecheck
npm run lint
```

Node 24+ recommended (see `.nvmrc`).

## Deploy

Phase 1 deploys to Cloudflare Pages. Setup steps land in [`docs/BUILD-LOG.md`](./docs/BUILD-LOG.md) when shipped.

## Security

This project sells security, so its own security posture is a prerequisite. See [`docs/SECURITY-POSTURE.md`](./docs/SECURITY-POSTURE.md) for the full checklist. Vulnerability reports: see [`/.well-known/security.txt`](./public/.well-known/security.txt).

## Brand

Voice, vocabulary, palette, and typography in [`docs/BRAND.md`](./docs/BRAND.md). The short version: calm, competent doctor — never hyped agency.
