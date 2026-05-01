# Security Posture

The required security configurations for The Code Doctors platform.
**This is non-negotiable.** We sell security. A weak posture invalidates the entire pitch.

Every change is reviewed against this checklist before deploy.

---

## Transport / TLS

- ☐ HTTPS only · all HTTP requests 301 redirect to HTTPS
- ☐ TLS 1.3 only · modern ciphers · no TLS 1.2 fallback unless required
- ☐ HSTS with **preload** flag · submitted to hstspreload.org
- ☐ SSL Labs grade: **A+**

## HTTP security headers (every response, every surface)

- ☐ `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- ☐ `Content-Security-Policy` — strict, **nonce-based** for scripts, no `unsafe-inline`, no `unsafe-eval`
- ☐ `X-Content-Type-Options: nosniff`
- ☐ `X-Frame-Options: DENY`
- ☐ `Referrer-Policy: strict-origin-when-cross-origin`
- ☐ `Permissions-Policy` — deny camera, microphone, geolocation, USB, payment (allow only what we use)
- ☐ `Cross-Origin-Opener-Policy: same-origin`
- ☐ `Cross-Origin-Embedder-Policy: require-corp` (where compatible)
- ☐ `Cross-Origin-Resource-Policy: same-origin`
- ☐ Mozilla Observatory grade: **A+**

## Information leakage

- ☐ `Server` header stripped
- ☐ `X-Powered-By` header stripped
- ☐ No source maps in production
- ☐ No verbose error pages in production
- ☐ No `.env`, `.git`, or build artifacts accessible publicly
- ☐ No framework fingerprints in cookies or headers

## DNS

- ☐ **DNSSEC** enabled
- ☐ **CAA records** restricting cert issuance to Cloudflare's CAs
- ☐ **SPF** record set
- ☐ **DKIM** signing enabled for Resend (and any other senders)
- ☐ **DMARC** policy at minimum `p=quarantine`, target `p=reject` once stable
- ☐ MTA-STS policy file at `/.well-known/mta-sts.txt`
- ☐ TLS-RPT reporting configured

## Edge protection (Cloudflare)

- ☐ WAF enabled with managed rule sets active
- ☐ Bot Management on
- ☐ DDoS protection on (default)
- ☐ Rate limiting rules: 60 req/min per IP on forms, 10 req/min on diagnostic tool, 5 req/min on auth
- ☐ Turnstile CAPTCHA on every public form
- ☐ Country-block list reviewed quarterly
- ☐ Admin subdomain has stricter WAF rules + optional IP allowlist for known staff IPs

## Authentication & sessions

- ☐ Passwords: bcrypt or argon2id, min 12 chars, breach-checked against haveibeenpwned API
- ☐ Magic links expire in 10 min, single-use
- ☐ **2FA mandatory for all staff accounts** (TOTP). No exceptions.
- ☐ 2FA optional and recommended for clients
- ☐ Session cookies: `Secure`, `HttpOnly`, `SameSite=Lax`, signed
- ☐ Session lifetime: 30 days client, **8 hours staff**, sliding expiration
- ☐ Logout invalidates server-side session
- ☐ Account lockout after 10 failed attempts in 15 min
- ☐ Email verification required before access to portal
- ☐ Password reset tokens single-use, 1 hour expiry

## Application

- ☐ All inputs validated server-side (Zod schemas at every boundary)
- ☐ All mutations are Server Actions (no exposed JSON APIs without auth)
- ☐ Parameterized queries only (Drizzle handles this; never raw SQL with interpolation)
- ☐ File uploads: type-checked, size-limited (5MB images, 25MB docs), virus-scanned via Cloudflare
- ☐ The diagnostic tool **must SSRF-protect**: block private IP ranges, file://, internal hostnames, redirects to internal
- ☐ Subresource Integrity (`integrity=`) on every external script
- ☐ No client-side secrets — env vars prefixed `NEXT_PUBLIC_*` reviewed individually

## Data

- ☐ Postgres: SSL required, IP-allowlisted to Cloudflare egress
- ☐ Database backups: daily, encrypted, 30-day retention
- ☐ PII encrypted at rest (Neon's default + column-level for sensitive fields)
- ☐ R2 buckets: private by default, signed URLs for access
- ☐ No third-party data leakage: no Google Analytics, no Facebook Pixel, no Hotjar without explicit review

## Audit & monitoring

- ☐ Sentry capturing errors with PII scrubbing
- ☐ Append-only audit log table for every staff-portal mutation
- ☐ Failed login attempts logged
- ☐ Cloudflare logs streamed for 30+ days
- ☐ Alert on: 5xx spikes, auth failures, WAF block surges, cert expiry < 30d

## Trust signals (public-facing)

- ☐ `/.well-known/security.txt` published with contact + PGP
- ☐ Public **Security Policy page** (`/security`) explaining what we do
- ☐ Vulnerability disclosure policy
- ☐ Status page at `status.thecodedoctors.com` (Phase 7)

## Incident response

- ☐ Documented incident playbook in `docs/incident-response.md` (Phase 5)
- ☐ Founder phone reachable for SEV-1 within 15 min
- ☐ Pre-drafted breach-notification template (legal review)

---

## Sign-off process

Before any deploy to production:
1. Run `npm audit` — zero high/critical
2. Run Mozilla Observatory scan — must remain A+
3. Run SSL Labs scan after any TLS change — must remain A+
4. Manual review of new env vars and secrets
5. ADR written for any deviation from this document
