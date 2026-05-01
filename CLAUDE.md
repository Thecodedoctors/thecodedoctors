# The Code Doctors

Multi-surface platform: marketing site + client portal + staff portal.
Founder-led agency selling website rebuild, maintenance retainers, and security services.
Cold-outreach business model: outbound emails to businesses → conversion endpoint is this site.

## Current state (as of 2026-05-01)
- **Phase**: Pre-Phase-1 — persistent context system established, code not yet scaffolded
- **Working directory**: greenfield (no code yet)
- **Operator**: Angel Tech Solutions (the parent company that owns and runs The Code Doctors). Personal info — name, email, anything tying the brand to an individual — must NEVER appear in code, configs, repo files, or commits. The brand is Angel-Tech-Solutions-as-The-Code-Doctors; never reference an individual.
- **Team at launch**: 5 doctors
- **Domain owned**: thecodedoctors.com
- **Industry positioning**: agnostic at launch (will streamline later once we see who converts)

## North star
Apple-tier polish. Million-dollar feel. The site itself must prove the security pitch
and the web-quality pitch. If a prospect opens devtools and finds anything mediocre,
the business dies. We do not ship "good enough."

## Surfaces
- `thecodedoctors.com` — public marketing site
- `app.thecodedoctors.com` — client/partner portal (submit requests, track status, chat, billing, site-health dashboard)
- `admin.thecodedoctors.com` — staff portal (universal inbox, CRM, monitoring, RBAC, mandatory 2FA)

## Stack (locked in 2026-05-01)
Next.js 15 App Router · TypeScript · Tailwind · shadcn/ui · Framer Motion · Lenis ·
Three.js / React Three Fiber · Postgres on Neon · Drizzle ORM · Auth.js (mandatory
2FA for staff) · Cloudflare R2 · Stripe · Resend · Plausible (self-hosted) · Sentry ·
Cloudflare end-to-end (Pages + Workers + WAF + Turnstile + DDoS).

See `docs/ARCHITECTURE.md` for the full rationale.

## Brand voice
Calm, competent doctor. Not hype-y agency. Lean into medical vocabulary throughout
copy and product:
Checkup, Diagnosis, Prescription, Treatment, Surgery, General Care, Premium Care,
Patient Stories, Doctor (= staff member), House Call (= on-site/emergency work).

See `docs/BRAND.md` for full voice & tone guide.

## Where to find things
- `docs/ROADMAP.md` — 7-phase build plan with status checkboxes (the source of truth for "what's done")
- `docs/ARCHITECTURE.md` — stack, infra, three-surface architecture, domain wiring
- `docs/BRAND.md` — voice, palette, typography, naming, copy patterns
- `docs/SECURITY-POSTURE.md` — required security configurations (non-negotiable; we sell security)
- `docs/decisions/` — architecture decision records (ADRs), one file per major call with date + rationale
- `docs/BUILD-LOG.md` — append-only session log of what was built and what's next

## How to work in this project (instructions for any future Claude session)
1. **Start every session by reading `docs/ROADMAP.md`** to see current phase + ticked items
2. **Read the latest entries in `docs/BUILD-LOG.md`** to see what was just built
3. **Before any architectural decision**, check `docs/decisions/` for existing ADRs
4. **After every meaningful change**, append a dated entry to `docs/BUILD-LOG.md` (one paragraph: what was built, what's next, any open questions)
5. **New architectural decisions** get a new ADR file in `docs/decisions/` (filename: `NNNN-short-title.md`)
6. **Quality bar**: ship nothing mediocre — better to ship one perfect section than three average ones. The brand promise dies on the first imperfect page
7. **Security posture**: every change is reviewed against `docs/SECURITY-POSTURE.md` before deploy. No exceptions
8. **Don't break the brand voice**: never write hype-y agency copy. We are doctors, calm and competent

## Memory pointers
The user's persistent memory store at `~/.claude/projects/c--Users-Strictly-Business-Documents-TheCodeDoctors/memory/` mirrors high-level context for cross-project continuity. The in-project `docs/` folder is the authoritative source for project-specific decisions and progress.
