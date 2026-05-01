# Portal Spec

The product specification for The Code Doctors patient and practice portals.

- **Status**: v1 draft, 2026-05-01
- **Owner**: Angel Tech Solutions (operator) + Claude (AI consultant)
- **Companion docs**: `ROADMAP.md` (when), `ARCHITECTURE.md` (how), `BRAND.md` (voice), `SECURITY-POSTURE.md` (non-negotiables)

This document exists because we shipped a richer-looking dashboard before we'd written down what the dashboard *is*. The result was placeholder cards added on the fly. This spec is the corrective: every surface, every user journey, every state, every notification, every column we still need — written down before we touch more code.

When this spec disagrees with what's in the codebase, the spec wins and we change the code. When the codebase needs something the spec doesn't cover, we update the spec first.

---

## Table of contents

1. [North star](#1-north-star)
2. [Information architecture](#2-information-architecture)
3. [Layout system](#3-layout-system)
4. [User journeys](#4-user-journeys)
5. [Permissions matrix](#5-permissions-matrix)
6. [State catalogue](#6-state-catalogue)
7. [Mobile spec](#7-mobile-spec)
8. [Notification taxonomy](#8-notification-taxonomy)
9. [Data model audit](#9-data-model-audit)
10. [Phased rollout](#10-phased-rollout)
11. [Open questions](#11-open-questions)

---

## 1. North star

Three sentences that define what we're building so every later decision can be measured against them:

1. **The patient portal is where work-in-flight is visible and replies happen.** Not a CRM, not a dashboard for vanity metrics. The first thing a patient sees on opening it must answer "is anything waiting on me?"

2. **The practice portal is where five doctors run a small, deliberate practice.** Inbox-first, audit-trail-second. Speed of triage and clarity of "who's doing what" beat every other concern.

3. **Both portals are quiet, fast, and look like clinical instruments.** Calm typography, generous whitespace, no dashboard-bro chart-vomit, no third-party widgets. The brand promise is "we're the doctors who care about quality" — the portal proves that with every interaction.

### Voice in product UI vs voice in marketing copy

The doctor metaphor (`Checkup`, `Diagnosis`, `Treatment`, `Patient Story`) is brand currency on the marketing surface — keep it strong there. **In the portal UI, default to plain language for any element a patient *operates*** — buttons, status labels, nav items, filters. The metaphor is great for storytelling; bad UX makes patients learn vocabulary just to find the reply button.

Concretely, in the portal:

- Buttons and CTAs say what they do: "Submit request", "Reply", "Send report" — **not** "Schedule a checkup", "Prescribe a fix".
- **Status labels visible to clients** lean plain:
  - Internal enum value `in_treatment` → patient-visible label **"In progress"**
  - `healed` → **"Resolved"**
  - `diagnosed` → **"Reviewed"** (still better than "Diagnosed" for a non-doctor)
  - `in_review` → **"Awaiting your approval"** (action-oriented for the client)
  - `triaged` and `closed` stay as-is (already plain).
- Section headings can keep a touch of voice ("About the practice", "Recent activity", "Patient portfolio" for staff) — these aren't action surfaces.
- Doctor titles in copy/email ("your doctor", "Dr. Maria") stay — they're naming choices, not jargon.

Rule of thumb: if a patient has to think for half a second about what a label means, change the label. The metaphor still permeates the writing — it just doesn't bog down the buttons.

### What the portals are NOT

- Not a marketing surface. The marketing job is on `thecodedoctors.com`.
- Not a real-time collaboration tool. We don't compete with Slack/Linear; we replace email + spreadsheets for an agency relationship.
- Not a public knowledge base. The knowledge base lives on the marketing surface (`/resources`, Phase 6) for SEO. The portals link out, they don't host their own.
- Not a multi-tenant SaaS in the heavy sense. One client = one organization. Phase-3-v1 assumes one user per client. Multi-user-per-client is a Phase 5 stretch.

---

## 2. Information architecture

### 2.1 Patient portal · `app.thecodedoctors.com`

Sitemap. URL on the left, surface description on the right. Phase tag in brackets means the surface is planned but not yet shipping; no tag means Phase 3.

```
/                                 Hub — "Needs your reply" + "In progress" + site-health pulse + plan summary
/requests                         List of all your requests, with filters
/requests/new                     Submit a new request (form)
/requests/[id]                    Request detail, message thread, file list
/requests/[id]/files              All files attached to this request                                 [Phase 3 v2]
/health                           Site Health overview                                               [Phase 6]
/health/scans                     History of every checkup ever run on your site                    [Phase 6]
/health/incidents                 Uptime incidents and their resolution                              [Phase 6]
/billing                          Plan, MRR, payment method, recent invoices                        [Phase 4]
/billing/invoices                 Full invoice history                                               [Phase 4]
/billing/invoices/[id]            Single invoice (download as PDF)                                   [Phase 4]
/notifications                    In-app inbox of every notification with read/unread state         [Phase 3 v2]
/settings                         Account settings landing
/settings/profile                 Your name, photo, timezone                                         [Phase 3 v2]
/settings/security                Password (when added), 2FA, active sessions, sign out everywhere  [Phase 3 v2]
/settings/notifications           Email/in-app/SMS preferences per notification type                 [Phase 3 v2]
/team                             Members of your account, roles, invite                            [Phase 5]
/referrals                        Refer-a-business with reward tracking                              [Phase 7]
/help                             Get-help shortcuts: email us, schedule a call, FAQ links
```

### 2.2 Practice portal · `admin.thecodedoctors.com`

```
/                                 Inbox + practice-wide stats. Default view: Needs Triage.
/requests                         Universal request list (deeper filters than the inbox tabs)        [Phase 5]
/requests/[id]                    Request detail with status select, assign, internal-note toggle
/clients                          CRM list of every client                                           [Phase 5]
/clients/[id]                     Client detail: profile, requests, files, activity, billing        [Phase 5]
/clients/[id]/health              That client's site health (when monitoring runs)                  [Phase 6]
/clients/new                      Manually onboard a new client (rare — most come via signup)        [Phase 5]
/fleet                            Grid of every client site's health (red/amber/green)              [Phase 6]
/audit                            Searchable, filterable audit log                                   [Phase 5]
/reports                          Practice analytics: MRR, request volume, response times           [Phase 5/6]
/knowledge                        Internal runbooks, playbooks, scripts                              [Phase 5]
/team                             Manage doctors: roles, schedule, on-call                           [Phase 5]
/settings                         Practice settings: brand, hours, automations, integrations         [Phase 5]
```

### 2.3 Cross-host auth surfaces

```
/login                            Magic-link sign-in form
/login/verify                     Check-your-inbox confirmation
/logout                           Sign-out endpoint
/verify-2fa                       TOTP challenge — required for staff after magic link              [Phase 5]
```

### 2.4 What's deliberately absent

- No `/dashboard` — too generic; the real concept is **/** (hub) on each subdomain.
- No `/api/*` user-facing surface. APIs exist but are internal.
- No tags / categories on requests in v1 — the request-`type` enum is enough. Tags arrive only when a customer asks.
- No comments-on-comments threading — flat thread per request keeps the model simple.

---

## 3. Layout system

The chrome — the persistent UI around every page.

### 3.1 Decision: sidebar nav for portals, top-bar for marketing

| Surface | Chrome | Why |
|---|---|---|
| Marketing (`thecodedoctors.com`) | Top bar + footer | We have it, it's beautiful, marketing has 5 nav items max. |
| Patient portal | Left sidebar (collapsible) + slim top bar | A portal is a workspace. Sidebars scale to ~10 nav items without crowding. |
| Practice portal | Left sidebar + slim top bar | Same. Staff need quick switching between clients/requests/audit. |

This is a **break from what we shipped**. The current portal-shell uses a top bar with two nav items. To grow beyond that without it feeling cramped, we move to a sidebar. The top bar shrinks to just: page title, search, notifications bell, user menu.

### 3.2 ASCII layout — desktop ≥ 1024 px

```
┌─ thin top bar ────────────────────────────────────────────────┐
│  ◴ Page Title              [⌘K Search]   [🔔 3]   [P ▾]      │
├──────┬────────────────────────────────────────────────────────┤
│  🩺  │                                                        │
│      │                                                        │
│  Hub │                  Page content                          │
│  Req │                                                        │
│  Hlt │                                                        │
│  Bil │                                                        │
│  KB  │                                                        │
│  ──  │                                                        │
│  Set │                                                        │
│  Hlp │                                                        │
│      │                                                        │
│  P ▾ │                                                        │
└──────┴────────────────────────────────────────────────────────┘
```

- Sidebar: 220 px wide, collapsible to 64 px (icon-only) via the user-menu toggle. Persists across reloads via cookie.
- Top bar: 56 px tall, sticky, glass-blur background.
- Content area: max-width 1280 px, centered, `px-8 py-10`.

### 3.3 Sidebar contents (patient portal)

```
[Logo: Code Doctors stethoscope mark + wordmark]
─────────────────────────────────────────────
Workspace nav
  ⌂  Hub                                 (matches '/')
  ▤  Requests                       3    (matches '/requests*')
  ♡  Site Health                         (matches '/health*')        — Phase 6 visible-but-disabled
  ◇  Billing                             (matches '/billing*')       — Phase 4 visible-but-disabled
  ◫  Knowledge                           — Phase 6 visible-but-disabled
─────────────────────────────────────────────
Account nav (bottom)
  ✦  Refer a friend                 — Phase 7 visible-but-disabled
  ⚙  Settings
  ?  Help
─────────────────────────────────────────────
[User menu — name, plan badge, sign out]
```

Numerical badges next to nav items show unread/pending counts. Greyed-out future items have a small "soon" pill.

### 3.4 Sidebar contents (practice portal)

```
[Logo: Code Doctors mark + "Practice"]
─────────────────────────────────────────────
Workflow nav
  ⌂  Inbox                          5
  ☰  All requests
  ❤  Patients                            — Phase 5
  ⌧  Fleet                               — Phase 6
─────────────────────────────────────────────
Operations nav
  ▦  Reports                             — Phase 5
  ◊  Audit                               — Phase 5
  ◫  Runbooks                            — Phase 5
─────────────────────────────────────────────
Practice nav (bottom)
  👥 Team                                — Phase 5
  ⚙  Settings                            — Phase 5
─────────────────────────────────────────────
[User menu — name, role, sign out]
```

### 3.5 Top-bar contents

| Element | Always visible | Behavior |
|---|---|---|
| Sidebar collapse toggle | Yes | Hamburger when sidebar collapsed, X when expanded |
| Page breadcrumb | Yes | Home › Requests › "Login broken" |
| Global search (⌘K) | Yes | Searches requests, files, clients (staff only). Phase 3 v2 / Phase 5. |
| Notifications bell | Yes | Dot when unread; click opens dropdown of last 10 with link to `/notifications`. Phase 3 v2. |
| User avatar menu | Yes | Settings, Sign out. Plan badge for clients. |

### 3.6 Mobile breakpoint < 768 px

Sidebar collapses fully — replaced by:
- Top-bar with hamburger that opens an overlay nav drawer.
- Bottom-bar with 4 primary nav items (Hub, Requests, Notifications, User).
- All other nav items are inside the drawer.

(Wireframes in §7.)

### 3.7 Components inventory

To build the chrome we need:

| Component | New / exists |
|---|---|
| `<AppSidebar variant="client" \| "admin">` | NEW |
| `<AppTopBar>` with breadcrumbs/search/bell/user | NEW (replaces current PortalShell top bar) |
| `<NavItem>` with active state, count badge, "soon" tag | NEW |
| `<UserMenu>` dropdown with avatar, plan, sign-out | NEW |
| `<NotificationsBell>` with dot + dropdown | NEW (Phase 3 v2) |
| `<CommandPalette>` (⌘K) | NEW (Phase 3 v2) |
| `<MobileNavDrawer>` | NEW |
| `<BottomNav>` (mobile) | NEW |
| `<Breadcrumbs>` | NEW |

The existing `PortalShell` component gets dismantled — its parts become `AppSidebar` + `AppTopBar`.

---

## 4. User journeys

The top journeys, end-to-end. For each: trigger → surfaces touched → outcome. v1 = must work for Phase 3 close-out; later phases tagged.

### 4.1 Patient — top 10

| # | Journey | v1? | Surfaces |
|---|---|---|---|
| 1 | First-time sign-up → submit first request | v1 | Marketing → /login → /login/verify → email → click link → / (auto-creates client) → /requests/new → /requests/[id] |
| 2 | Reply to a doctor on an existing request | v1 | Email or in-app notif → /requests/[id] → composer → send → confirmation |
| 3 | Submit an urgent request | v1 | / → "New request" CTA → /requests/new (priority=urgent) → /requests/[id] |
| 4 | Check what's waiting on me | v1 | / → "Needs your reply" feed → click row → /requests/[id] |
| 5 | Search past requests | Phase 3 v2 | ⌘K or /requests → search input → filter results |
| 6 | Approve a deliverable from doctor | Phase 3 v2 | Notif → /requests/[id] → "Approve" button → status moves to Healed |
| 7 | Pay an outstanding invoice | Phase 4 | Notif/email → /billing/invoices → click → Stripe Checkout → success |
| 8 | Change plan (upgrade) | Phase 4 | /billing → "Change plan" modal → confirm → effective next cycle |
| 9 | Update notification preferences | Phase 3 v2 | /settings/notifications → toggle channels → save |
| 10 | Sign out everywhere | Phase 3 v2 | /settings/security → "Sign out everywhere" → all sessions invalidated |

### 4.2 Staff — top 10

| # | Journey | v1? | Surfaces |
|---|---|---|---|
| 1 | Triage a new request | v1 | Notif → / Needs Triage tab → click → /requests/[id] → assign-to-self → set priority → reply |
| 2 | Reply to a patient | v1 | / Mine tab → request → composer (visible) → send |
| 3 | Add an internal note | v1 | /requests/[id] → composer → Internal toggle → send |
| 4 | Update request status | v1 | /requests/[id] → status select → Update → audit log entry written |
| 5 | Reassign to a teammate | Phase 5 | /requests/[id] → assignee dropdown → select doctor → save |
| 6 | Manually onboard a new client | Phase 5 | /clients/new → form → invite primary user → magic link sent |
| 7 | Issue an invoice | Phase 4 | /clients/[id]/billing → New Invoice → fill → send |
| 8 | Search across all requests/clients | Phase 5 | ⌘K → results across all tables |
| 9 | Audit "who changed status to Healed on Acme last Friday" | Phase 5 | /audit → filters → drill into entry → see before/after JSON |
| 10 | Generate monthly client report | Phase 6 | /clients/[id] → "Generate report" → PDF created in /clients/[id]/reports |

### 4.3 Sequence detail — Journey 1 (sign-up)

```
1. Visitor on marketing → clicks "Sign in" or hits app.thecodedoctors.com
2. /login → enters email → submits
3. signIn("resend", { email }) → magic link sent → /login/verify
4. Email arrives → click link → /api/auth/callback/resend
5. Auth.js verifies token, creates user row, sets session cookie (Domain=.thecodedoctors.com)
6. Redirect callback rewrites '/dashboard' → 'https://app.thecodedoctors.com/'
7. Browser lands at app/, layout's auth() check passes
8. Server-side getOrCreateClientForUser() runs → creates client + clientMember
9. Page renders the empty Hub state with "Submit your first request" CTA
10. User clicks → /requests/new
11. Submits form → server action createRequest → DB insert → revalidatePath →
    redirect '/requests/[id]'
12. /requests/[id] renders with empty thread, status=triaged
13. Behind the scenes: notification fires to staff via [Phase 3 v2 notification system]
```

### 4.4 Sequence detail — Journey 2 (reply)

```
1. Doctor posts a reply on /admin/requests/[id]
2. addMessage server action → DB insert → revalidatePath
3. [Phase 3 v2] Notification fires:
   - In-app: row added to notification table for client_owner
   - Email: Resend send to client's email if email channel enabled
4. Client receives email "Doctor replied to 'Login broken'"
5. Click link → app.thecodedoctors.com/requests/[id]
6. Marker: server action records 'message.read' on first view (Phase 3 v2)
7. Client composes reply → addMessage → revalidatePath → list updates
```

---

## 5. Permissions matrix

### 5.1 Roles

**Patient-side roles** (live on the `client_member.role` column — currently just an `is_admin` boolean; needs to expand):
- `owner` — created the client (org). Full access, including billing and team.
- `member` — invited team-mate. Can submit/reply on requests, can't change billing or invite.
- `viewer` — read-only. Can see requests but not submit or reply. Useful for stakeholders.

**Practice-side roles** (live on the `user.role` column — already there):
- `founder` — full access including team management.
- `senior_doctor` — full read/write across all clients, can manage runbooks.
- `doctor` — full read across all clients; full write on assigned requests.
- `readonly` — auditors, advisors. Read-only across everything, no mutations.

`client` is the default role for sign-ups; not a "staff" role.

### 5.2 Capability matrix (excerpt)

| Capability | client.owner | client.member | client.viewer | doctor | senior | founder | readonly |
|---|---|---|---|---|---|---|---|
| View own client's requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View any client's requests | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Submit a request | ✓ | ✓ | ✗ | ✓ on assigned | ✓ | ✓ | ✗ |
| Post a visible message | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| Post an internal note | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| Read internal notes | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Update request status | ✗ | ✗ | ✗ | ✓ on assigned | ✓ | ✓ | ✗ |
| Assign / reassign | ✗ | ✗ | ✗ | self only | ✓ | ✓ | ✗ |
| Approve a deliverable | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| View invoices | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Pay an invoice | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Change plan | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Invite teammate to client | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Onboard new client | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Manage staff team | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| View audit log | own actions | own actions | ✗ | own actions | ✓ | ✓ | ✓ |
| Generate report | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Read site health | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Trigger a manual scan | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |

### 5.3 Authorization implementation

A central `ability(session, action, resource?)` helper. Pattern:

```ts
ability(session, "request.update_status", { request });   // returns boolean
ability(session, "billing.change_plan");
```

Failures throw `ForbiddenError` which the layout catches and renders as a 403 page. Server actions should always check before mutating; layouts/pages should check before rendering.

This replaces the ad-hoc `requireUser`/`requireStaff`/`requireClient` helpers we have today, which only handle the coarsest split. Phase 3 v2.

---

## 6. State catalogue

For every list/detail surface, define the five states. Anything missing one of these is unfinished.

| State | Pattern |
|---|---|
| **Loading** | Skeleton layout matching final shape. Suspense boundary at the panel level (not whole-page). |
| **Empty** | Friendly empty state with a primary CTA, in voice. Never an error tone. |
| **Partial** | Show what data we have; progressively reveal what's still loading via Suspense. |
| **Error** | In-voice error card ("Something didn't respond. Try again in a moment.") with a Retry button + a help link. |
| **Forbidden** | "You don't have access to this." + sign-out / switch-account link. |

### 6.1 Per-surface specs

**Hub (`/`)** — combines five panels (per dashboard plan above). Loading: skeleton each panel independently. Empty: per-panel ("No requests yet — submit one." for the requests panel; "No activity yet" for activity feed).

**Requests list (`/requests`)** — table-style, sortable by status / priority / updatedAt. Filters: status pills, priority, assignee (staff only). Empty: "No requests match these filters" if filters active, or full empty state otherwise. Partial: paginate at 25/page.

**Request detail (`/requests/[id]`)** — Loading: skeleton header + thread placeholder. Empty thread: "No messages yet — write the first reply below." Error on a 404: "This request is not on file." with link back. Forbidden: see §6.

**Notifications inbox (`/notifications`)** — Loading: 5 skeleton rows. Empty: "All caught up." with a faint stethoscope mark.

**Settings (`/settings/*`)** — Each section has its own optimistic-update form. On save: subtle inline "Saved" message that auto-dismisses after 2s. On error: the inline error pattern from the diagnostic tool.

### 6.2 Time formatting rule

- < 60s: "just now"
- < 60m: "Nm"
- < 24h: "Nh"
- < 7d: "Nd"
- ≥ 7d: localised short date ("Mar 14")

Always render the relative on the surface; show the absolute time on hover (`<time title="2026-05-01T14:23:00Z">`).

### 6.3 Numbers

- Counts < 1000: rendered as-is.
- 1000–999,999: "1.2k"
- ≥ 1M: "1.4M"
- Money: `$129.00` (always with the cents, even when 00).

---

## 7. Mobile spec

Top 5 surfaces for the patient portal. Wireframes ASCII-style — actual layout uses Tailwind's `sm:` and `md:` breakpoints (640 / 768).

### 7.1 Hub (mobile)

```
┌───────────────────────────────────┐
│ ☰   Hub          🔔   P           │ ← top bar (56px)
├───────────────────────────────────┤
│ Hi Precious.                       │
│ 2 open · 1 needs your reply       │
│                                    │
│ ┌─────────────────────────────┐   │
│ │ Needs your reply             │   │
│ │ ▸ Login broken     2h ago    │   │ ← stacked, full-width cards
│ │ ▸ Footer alignment 1d ago    │   │
│ └─────────────────────────────┘   │
│                                    │
│ ┌─────────────────────────────┐   │
│ │ In progress                   │   │
│ │ ▸ Speed audit · Reviewed      │   │
│ └─────────────────────────────┘   │
│                                    │
│ ┌─────────────────────────────┐   │
│ │ + Submit a new request       │   │
│ └─────────────────────────────┘   │
├───────────────────────────────────┤
│  ⌂      ▤      🔔      P          │ ← bottom nav (4 items, 56px)
└───────────────────────────────────┘
```

### 7.2 Request detail with composer (mobile)

```
┌───────────────────────────────────┐
│ ←  Login broken          🔔  P    │
├───────────────────────────────────┤
│ #abc12   Reviewed · High          │
│ Login broken on Safari iOS 17     │
│                                    │
│ Description (collapse beyond 5 lines)
│ Lorem ipsum...                    │
│                                    │
│ ── Conversation ──                │
│                                    │
│ [Doctor card]                     │
│  Dr. Maria · 2h ago                │
│  Tried to reproduce but our test   │
│  iPhone is on iOS 18. Can you...   │
│                                    │
│ [Your card]                       │
│  You · 1h ago                      │
│  Just tried — still broken         │
│                                    │
├───────────────────────────────────┤
│ [textarea, full width, 3 rows]    │ ← sticky composer at bottom
│                       [Send →]    │
└───────────────────────────────────┘
```

### 7.3 New request form (mobile)

Stack everything vertically with full-width inputs. `text-base` (16px+) on every input to prevent iOS auto-zoom. Submit button is sticky at bottom of the form, full-width.

### 7.4 Notifications inbox (mobile)

```
┌───────────────────────────────────┐
│ ☰  Notifications        Mark read │
├───────────────────────────────────┤
│ ● Dr. Maria replied              │
│   on Login broken · 2h            │
│ ─────────────────────────────────│
│   Status changed to Reviewed     │
│   on Speed audit · 1d             │
│ ─────────────────────────────────│
│   You submitted Footer fix · 3d  │
└───────────────────────────────────┘
```

### 7.5 Mobile interaction rules

- Tap targets minimum 44×44 px (Apple HIG).
- Forms: `font-size: 16px+` always.
- Drawers slide from the side; modals slide from the bottom (iOS feel).
- Back gesture works on every page (Next.js `<Link>` + browser back).
- No hover-only affordances. Every action has a tap target.

---

## 8. Notification taxonomy

The single source of truth for "when do we tell the user something happened, on which channel, with what default."

### 8.1 Trigger event × channel matrix

| Event | In-app | Email | SMS [Phase 5] | Default | Who |
|---|---|---|---|---|---|
| New reply on your request | ✓ | ✓ | ✗ | both | Patient |
| Internal note added | (staff only, in-app) | — | — | in-app | Staff |
| Status changed to In Progress | ✓ | ✓ | ✗ | both | Patient |
| Status changed to Awaiting Your Approval | ✓ | ✓ | ✗ | both | Patient |
| Status changed to Resolved | ✓ | ✓ | ✗ | email | Patient |
| New request submitted | ✓ | (digest) | (urgent only) | in-app | Staff |
| Urgent request submitted | ✓ | ✓ | ✓ | all | Staff |
| Request unanswered for 24h | ✓ | ✓ | ✗ | both | Staff (assignee) |
| Plan changed | ✓ | ✓ | ✗ | email | Patient owner |
| Invoice issued | ✓ | ✓ | ✗ | email | Patient owner |
| Invoice paid | ✗ | ✓ | ✗ | email | Patient owner + staff |
| Payment failed | ✓ | ✓ | ✓ if SMS configured | all | Patient owner |
| Failed login attempt (5×) | ✓ | ✓ | ✗ | both | The user |
| New session signed in | ✓ | (only if from new IP) | ✗ | in-app | The user |
| Site health check failed | ✓ | ✓ | optional | both | Patient + assigned doctor |
| Referral converted to paying customer | ✓ | ✓ | ✗ | email | Patient referrer |
| New team-mate accepted invite | ✓ | ✓ | ✗ | email | Patient owner |

### 8.2 User-controllable preferences

Per user (not per client), live on `notification_preference` table (Phase 3 v2):

```
notification_preference
├ user_id
├ event_key       (e.g. "request.message")
├ in_app         boolean default true
├ email          boolean default true
├ sms            boolean default false
└ digest         enum ('immediate','hourly','daily','off') default 'immediate'
```

Defaults from the matrix above. Users can override per event in `/settings/notifications`. Email-disabled is permitted; in-app-disabled is NOT for billing/security events (regulatory floor).

### 8.3 Email rendering rule

All transactional emails:
- From: `The Code Doctors <hello@thecodedoctors.com>`
- Subject: action-first, no fluff. ✓ "Dr. Maria replied · Login broken" / ✗ "🚀 You have a new message!"
- Body: ≤ 250 words, plain language, primary action button (deep-link to specific surface, not generic dashboard).
- Reply-to: `hello@thecodedoctors.com` (replies become support tickets in Phase 5).
- Footer: practice address (legal req for transactional), unsubscribe link for non-essential events only.

### 8.4 Digest vs immediate

For high-volume events (new request → staff), default is `immediate` for the assignee but `daily` for the rest of the team. Patients always get immediate by default. Per-event override is allowed.

---

## 9. Data model audit

Current schema (in `src/db/schema.ts`) vs what the spec needs.

### 9.1 Tables we already have

```
user                  ✓ (extended w/ role, totp_secret, totp_enabled, two_factor_required, last_login_at)
account               ✓ (Auth.js)
session               ✓ (Auth.js)
verificationToken     ✓ (Auth.js)
client                ✓
client_member         ✓
request               ✓
message               ✓
file                  ✓ (Phase 3 v2 will populate it)
audit_log             ✓
lead                  ✓
scan                  ✓
```

### 9.2 Tables we still need

| Table | When | Why |
|---|---|---|
| `notification` | Phase 3 v2 | In-app inbox + delivery state per user |
| `notification_preference` | Phase 3 v2 | Per-user, per-event channel toggles |
| `team_invite` | Phase 5 | When we add multi-user-per-client, this is the pending-invite token table |
| `subscription` | Phase 4 | Stripe subscription mirror (id, plan, status, current_period_end, cancel_at) |
| `invoice` | Phase 4 | Stripe invoice mirror, plus our own line items for time-based billing |
| `payment_method` | Phase 4 | Stored Stripe payment-method ids for self-service |
| `health_check` | Phase 6 | Periodic Lighthouse + uptime + SSL ping result, indexed by client + ts |
| `incident` | Phase 6 | Uptime / downtime windows, status (open/closed/resolved) |
| `monthly_report` | Phase 6 | Generated PDF metadata + R2 storage key |
| `knowledge_article` | Phase 6 | Marketing-side knowledge base. Slug, title, body markdown, tags. |
| `referral` | Phase 7 | Patient → referred-business-name → reward state |

### 9.3 Columns we need to add to existing tables

| Table | Column | Type | When | Why |
|---|---|---|---|---|
| `request` | `url` | `text` | Phase 3 v2 | Currently jammed into description; needs its own column for Site Health linking |
| `request` | `eta` | `timestamp` | already exists | Set by staff during triage |
| `request` | `customer_satisfaction` | `int` (1-5) | Phase 3 v2 | Survey on Healed status |
| `request` | `archived_at` | `timestamp` | Phase 3 v2 | Soft-archive instead of delete |
| `message` | `edited_at` | `timestamp` | Phase 3 v2 | Track edits (optional UX) |
| `message` | `deleted_at` | `timestamp` | Phase 3 v2 | Soft-delete |
| `message` | `attachments` | `jsonb` | Phase 3 v2 | Array of file ids |
| `client` | `stripe_customer_id` | `text` | Phase 4 | |
| `client` | `stripe_subscription_id` | `text` | Phase 4 | |
| `client` | `billing_email` | `text` | Phase 4 | Defaults to owner's email but overridable |
| `client_member` | `role` | enum | Phase 5 | Replace `is_admin` boolean with owner/member/viewer |
| `user` | `image` (Auth.js standard) | `text` | already exists | Profile photo URL |
| `user` | `phone_e164_encrypted` | `text` | Phase 5 | For SMS, encrypted at app layer |
| `user` | `timezone` | `text` | Phase 3 v2 | For digest scheduling and timestamp display |
| `audit_log` | `severity` | enum (`info`, `warning`, `critical`) | Phase 5 | Filter audit log by severity |
| `audit_log` | `category` | `text` | Phase 5 | Group by category in UI |

### 9.4 Indexes we should add

```
notification:        (user_id, created_at desc) where read_at is null
notification:        (user_id, event_key)
health_check:        (client_id, checked_at desc)
incident:            (client_id, status)
invoice:             (client_id, status, due_at)
audit_log:           (target_type, target_id, ts desc)        -- already partly exists
audit_log:           (severity, ts desc)
```

---

## 10. Phased rollout

What ships when. This refines `ROADMAP.md` with what we now know from this spec.

### 10.1 Phase 3 v1 close-out (current)

Already shipped:
- Subdomain routing
- Auth + magic-link sign-in
- Request CRUD (submit / list / detail) + thread
- Staff inbox with Triage/Mine/All tabs
- Status update + assign-to-self
- Multi-panel client + staff dashboard

To close out v1:
- Replace `PortalShell` (top-bar) with the new sidebar layout from §3
- Add the basic mobile chrome (drawer + bottom nav)
- Audit-log mutations to add: status change ✓, assign ✓, message-add ✗ (need to add)
- Empty/loading/error states audit per §6
- Time formatting helper extracted into `src/lib/time.ts` (currently inline in two components)

### 10.2 Phase 3 v2 (next sprint, ~1 week)

The "make the portal feel real" pass:
- **Notifications system** — table + writes from server actions + in-app dropdown + `/notifications` inbox + email channel for "new reply" and "status changed"
- **R2 file uploads** — direct presigned-URL uploads from request form, attach to message, render thumbnails
- **`/settings/profile`** + **`/settings/notifications`** + **`/settings/security`** (basic versions)
- **Approve-deliverable flow** — when status moves to `in_review`, the patient sees an Approve / Request Changes button on the request page; Approve → status `healed`
- **Soft-archive requests** + filter for archived
- **Search** (basic, server-side LIKE) over request titles/descriptions on `/requests`
- **Reaction message** (👍 / ❤️ on a thread message) — small, makes the thread feel less stiff. Optional.

### 10.3 Phase 4 — Stripe + plans

- Stripe products: Checkup, General Care, Premium Care
- Subscription checkout via Stripe Checkout
- Self-service portal: change plan, update payment method, view invoices
- Webhook → invoice + subscription tables
- Plan-gating: certain portal surfaces only for paying clients (e.g., Site Health real data)
- Failed-payment dunning emails

### 10.4 Phase 5 — Staff CRM + ops

- TOTP 2FA mandatory for staff (the schema is ready)
- `client_member.role` enum migration (owner/member/viewer)
- Team invites: `team_invite` table + flow
- `/clients` CRM list with filters (plan, status, MRR, last contact)
- `/clients/[id]` full client detail
- `/audit` viewer with filters + search + export CSV
- `/team` staff management
- Time tracking on requests
- Manual-onboarding flow at `/clients/new`
- `/reports` for practice analytics

### 10.5 Phase 6 — Site Health monitoring

- Recurring Lighthouse scans via cron Worker
- `health_check` table + Lighthouse-over-time graphs
- Uptime monitoring (Better Stack or Cloudflare Worker cron)
- SSL expiry alerts
- `incident` table + `/health/incidents` page
- `/fleet` for staff (red/amber/green grid)
- Monthly report generation as PDF (`@react-pdf/renderer` or print stylesheet)
- Knowledge base on marketing surface (`/resources`)

### 10.6 Phase 7 — Polish + WebGL + status page

- Three.js EKG hero on marketing
- Custom cursor
- Live-counter ticker on marketing
- Public status page at `status.thecodedoctors.com`
- Refer-a-business with reward tracking
- View Transitions API rich animations

### 10.7 Always-on after Phase 4

- A/B testing on plan landing pages
- SEO blog cadence
- Monthly security retros (run our own scanner against ourselves)
- Customer interview cadence — every 5 new clients, 30-min interview

---

## 11. Open questions

These are decisions we haven't made yet, parked for when they become urgent:

1. **What's the single source of truth for "this client's site"?** A request URL, a stored URL on `client.website_url`, or many URLs (multi-site clients)? Spec assumes one URL per client; multi-site is a Phase 6 question.

2. **How do clients sign up after a checkup but before paying?** Right now `/checkup` captures a lead row. Do we auto-promote leads to clients on first sign-in, or require manual onboarding? Spec assumes auto-promote.

3. **Do we want a canned "First steps" checklist on the patient hub** (welcome → submit first request → connect site URL → invite teammate)? Probably yes for retention, but not in v1.

4. **What's the SLA we promise on each plan?** "Within 1 business day" is current copy; this should be enforceable in software (alert if no staff response in N hours). Phase 5.

5. **Multi-language?** Not on the roadmap. Default English, design for it but no i18n infrastructure in v1.

6. **Are there any legal/compliance requirements** specific to "selling security to small businesses" that affect the portal? GDPR yes (we handle EU traffic), SOC 2 maybe later. Worth a 1-hour legal review before Phase 6.

7. **What happens to a client's data when they discharge (close the account)?** Default: 90-day retention then archive. Spell this out in `/privacy` and the Terms.

8. **Do staff get their own audit log** (separate from the practice-wide one) showing only their actions? Useful for self-review but adds a query. Phase 5.

---

## Conventions

- This doc is **append-only-leaning**. When a section's plan changes, edit in place but mark with a date and reason in a small "Revisions" entry at the bottom of that section. Major restructures get a new ADR in `docs/decisions/`.
- "v1 / Phase X" tags in this doc are the canonical scope boundaries for the codebase.
- When we ship something, the corresponding row in §10 gets a ✅ check.

---

*End of spec.*
