import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  jsonb,
  boolean,
  bigint,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* ──────────────────────────────────────────────────────────────────────────
   Enums
   ──────────────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", [
  "client",
  "doctor",
  "senior_doctor",
  "founder",
  "readonly",
]);

export const clientStatus = pgEnum("client_status", [
  "lead",
  "active",
  "paused",
  "discharged",
]);

export const clientPlan = pgEnum("client_plan", [
  "checkup",
  "general",
  "premium",
  "custom",
]);

export const requestStatus = pgEnum("request_status", [
  "triaged",
  "diagnosed",
  "in_treatment",
  "in_review",
  "healed",
  "closed",
]);

export const requestPriority = pgEnum("request_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const requestType = pgEnum("request_type", [
  "bug",
  "improvement",
  "security",
  "seo",
  "performance",
  "redesign",
  "other",
]);

export const leadSource = pgEnum("lead_source", [
  "checkup",
  "book",
  "newsletter",
  "other",
]);

/* ──────────────────────────────────────────────────────────────────────────
   Auth.js core tables (table names are mandated by the Drizzle adapter spec)
   We extend `user` with our own `role` / `totp_*` columns; Auth.js ignores
   any columns it doesn't know about.
   ──────────────────────────────────────────────────────────────────────── */

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // Code Doctors extensions
  role: userRole("role").notNull().default("client"),
  passwordHash: text("password_hash"),
  /** Short shareable code for /dashboard/referrals. Generated on first
   *  view. Unique when set (partial unique index in the live DB). */
  referralCode: text("referral_code"),
  totpSecret: text("totp_secret"), // encrypted at the app layer
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** PBKDF2 hashes of single-use recovery codes generated at TOTP
   *  setup. JSON-encoded array. Each code is consumed by removing
   *  its hash from the array. */
  totpRecoveryCodes: text("totp_recovery_codes"),
  twoFactorRequired: boolean("two_factor_required").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  /** Suspended users can't sign in. Cleared when un-suspended. */
  suspendedAt: timestamp("suspended_at", { mode: "date" }),
  suspensionReason: text("suspension_reason"),
  /** Soft-deleted users can't sign in and password is wiped. Hard
   *  delete stays SQL-only because of the FK consequences. */
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  deletionReason: text("deletion_reason"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    primaryKey({ columns: [vt.identifier, vt.token] }),
  ]
);

/* ──────────────────────────────────────────────────────────────────────────
   Domain tables
   ──────────────────────────────────────────────────────────────────────── */

export const clients = pgTable(
  "client",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    primaryUserId: text("primary_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    plan: clientPlan("plan").notNull().default("checkup"),
    status: clientStatus("status").notNull().default("lead"),
    mrrCents: integer("mrr_cents").notNull().default(0),
    leadDoctorId: text("lead_doctor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Path the patient arrived via: 'trial' (from /checkup) or 'plan' (paid).
     *  Null on legacy / seeded clients. */
    signupSource: text("signup_source"),
    /** When their free trial expires. Null when on a paid plan or no trial. */
    trialEndsAt: timestamp("trial_ends_at", { mode: "date" }),
    /** The referralCode of the patient who referred this client, if any.
     *  Stored as the literal code (not user_id) so the referrer's code can
     *  be revoked/rotated without breaking attribution. */
    referredByCode: text("referred_by_code"),
    /** Stripe linkage. Null until the patient first checks out. */
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    /** End of the current billing period; what the dashboard renders as
     *  "Renews on" or "Access until". */
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    /** Set when the patient cancels — they keep access until
     *  current_period_end, then it lapses. */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    notes: text("notes"),
    /** Set whenever the practice changes status to "paused" or
     *  "discharged" with a reason; cleared when status flips back to
     *  "active" or "lead". Mirrors users.suspensionReason / deletionReason. */
    statusReason: text("status_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("client_status_idx").on(t.status)]
);

/** Many-to-many: which users are members of which client (team accounts). */
export const clientMembers = pgTable(
  "client_member",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.userId] })]
);

/**
 * Backup ledger — one row per snapshot we take of a patient's site.
 * The actual archives live elsewhere (host-provided / R2 / etc.); this
 * table is what the patient sees in their portal so they know we're
 * actually doing the thing the plan promises.
 *
 * Recorded by the doctor (manual today; can be wired to an automated
 * job later — same schema works for both).
 */
export const clientBackups = pgTable(
  "client_backup",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    recordedByUserId: text("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** The kind of backup — DB-only, files-only, or both. */
    kind: text("kind").notNull().default("full"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    /** Where the archive is stored — opaque string the doctor enters
     *  (e.g. `r2://tcd-backups/2026-05-03-lumiere.tar.gz` or a host
     *  panel URL). NOT a download link by itself; the patient sees
     *  "stored: <provider>" treatment, not the raw key. */
    location: text("location"),
    /** Free-text notes — what was included, what was excluded, etc. */
    notes: text("notes"),
    takenAt: timestamp("taken_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("client_backup_client_idx").on(t.clientId),
    index("client_backup_taken_idx").on(t.takenAt),
  ]
);

/**
 * Public service incidents — surfaced on the /status page. Doctors
 * create and update these; patients (and the public) just read.
 */
export const incidents = pgTable(
  "incident",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    /** "minor" — degraded perf for a subset of patients
     *  "major"  — partial outage
     *  "critical" — total outage */
    severity: text("severity").notNull().default("minor"),
    /** Ongoing narrative — most recent update at top. Markdown-ish. */
    body: text("body").notNull().default(""),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("incident_started_idx").on(t.startedAt),
    index("incident_resolved_idx").on(t.resolvedAt),
  ]
);

/**
 * Tiny rate-limit counter — one row per (key, window-start). Keys are
 * scoped strings like `login:user@example.com` or `checkup:1.2.3.4`.
 * The check + increment is a single upsert, so it works across worker
 * isolates (in-memory rate limiters don't, on Cloudflare).
 *
 * Cleared by the next cron pass — we don't need rows older than the
 * largest window we use.
 */
export const rateLimitCounters = pgTable(
  "rate_limit_counter",
  {
    /** Compound key: `<scope>:<bucket>:<window-start-epoch-seconds>`. */
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  },
  (t) => [index("rate_limit_expires_idx").on(t.expiresAt)]
);

/**
 * Webhook event ledger — records every Stripe event id we've already
 * processed so a retry (which Stripe legitimately does on 5xx + on
 * transient network blips) doesn't fire side-effects twice. Insert
 * the event id at the top of POST; if it conflicts on the unique PK,
 * we know we've seen it before and short-circuit.
 *
 * Cleared periodically by a cron job — we don't need history older
 * than ~30 days.
 */
export const webhookEvents = pgTable(
  "webhook_event",
  {
    /** The Stripe `event.id` (or another provider id). */
    id: text("id").primaryKey(),
    source: text("source").notNull().default("stripe"),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("webhook_event_received_idx").on(t.receivedAt)]
);

/**
 * Doctor-requested credentials. The founder asks for sensitive things
 * (hosting login, registrar access, API keys, etc.); the patient
 * submits values via /dashboard/credentials; we encrypt the bundle
 * at rest with `CREDENTIAL_ENCRYPTION_KEY` and surface the plaintext
 * only to the founder, on demand, with every view audited. After the
 * doctor is done they "close" the request — which wipes the blob from
 * the row, keeping only the metadata.
 *
 * State machine:
 *   open       (encrypted_submission IS NULL,    closed_at IS NULL)
 *   submitted  (encrypted_submission IS NOT NULL, closed_at IS NULL)
 *   closed     (closed_at IS NOT NULL — encrypted_submission wiped)
 */
export const credentialRequests = pgTable(
  "credential_request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    /** Field schema as JSON — list of `{ key, label, kind, required }`
     *  describing what the patient should fill in. Doctor sets this
     *  when creating the request. */
    fieldsSchema: text("fields_schema").notNull().default("[]"),
    /** Encrypted JSON blob of `{ key: value }` after the patient
     *  submits. Format: `v1:<iv-b64>:<ciphertext-b64>`. Wiped on close. */
    encryptedSubmission: text("encrypted_submission"),
    /** Bumped if we ever rotate `CREDENTIAL_ENCRYPTION_KEY`. */
    encryptionVersion: text("encryption_version"),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
    submittedByUserId: text("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    closedAt: timestamp("closed_at", { mode: "date" }),
    closedByUserId: text("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Free-form note the founder leaves when closing — e.g.
     *  "Rotated; safe to discard." Visible to staff only. */
    closeNote: text("close_note"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("credential_request_client_idx").on(t.clientId),
    index("credential_request_submitted_idx").on(t.submittedAt),
    index("credential_request_closed_idx").on(t.closedAt),
  ]
);

/**
 * Per-patient monthly reports. Authored by a doctor (status `draft`
 * until they hit publish), then frozen + emailed to the patient.
 *
 * Patients see only `published` reports under /dashboard/reports.
 * Doctors see every state on /admin/reports.
 */
export const monthlyReports = pgTable(
  "monthly_report",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Title shown in the listing. Defaults to the period label
     *  ("January 2026") if the doctor leaves it blank. */
    title: text("title").notNull().default(""),
    /** Markdown-ish body — we render with a tight whitelist client-side. */
    body: text("body").notNull().default(""),
    /** Reporting period — anchors on calendar months but the doctor
     *  can override (e.g. "first 30 days of care"). */
    periodStart: timestamp("period_start", { mode: "date" }).notNull(),
    periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
    /** Set when the doctor publishes. Patients only see published rows. */
    publishedAt: timestamp("published_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("monthly_report_client_idx").on(t.clientId),
    index("monthly_report_published_idx").on(t.publishedAt),
  ]
);

export const requests = pgTable(
  "request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    /** Author of the original request. NOT marked notNull because the
     *  FK is `onDelete: "set null"` (the two were a runtime conflict in
     *  Postgres — you can't satisfy both). When a user gets hard-deleted
     *  via SQL, their authored requests stay on the medical record with
     *  a null author, which is what we want. */
    submittedByUserId: text("submitted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedDoctorId: text("assigned_doctor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    /** The site URL this request is about. Optional today; spec moves URL
     *  capture to sign-up in Phase 4. See `project_signup_url_capture` memo. */
    url: text("url"),
    type: requestType("type").notNull().default("improvement"),
    priority: requestPriority("priority").notNull().default("medium"),
    status: requestStatus("status").notNull().default("triaged"),
    eta: timestamp("eta", { mode: "date" }),
    timeSpentMinutes: integer("time_spent_minutes").notNull().default(0),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("request_client_idx").on(t.clientId),
    index("request_status_idx").on(t.status),
    index("request_assigned_idx").on(t.assignedDoctorId),
    index("request_archived_idx").on(t.archivedAt),
  ]
);

export const messages = pgTable(
  "message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    /** Author. Same FK reasoning as `requests.submittedByUserId` — drop
     *  notNull so the `onDelete: set null` cascade actually works.
     *  Hard-deleting a user keeps the message text on the record with
     *  a null author (rendered as "(deleted user)" in the UI). */
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    /** Internal notes are visible to staff only. */
    internal: boolean("internal").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("message_request_idx").on(t.requestId)]
);

export const files = pgTable(
  "file",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    requestId: text("request_id").references(() => requests.id, {
      onDelete: "cascade",
    }),
    /** Uploader. Same FK reasoning as `messages.authorUserId` —
     *  drop notNull so `onDelete: set null` doesn't conflict. Files
     *  remain attached to the request after the uploader is deleted. */
    uploaderUserId: text("uploader_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    filename: text("filename").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    contentType: text("content_type").notNull(),
    /** R2 object key. */
    storageKey: text("storage_key").notNull().unique(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  }
);

/** Append-only. NEVER updated; admin actions are logged here for audit. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ts: timestamp("ts", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_actor_idx").on(t.actorUserId),
    index("audit_target_idx").on(t.targetType, t.targetId),
    index("audit_ts_idx").on(t.ts),
  ]
);

/** Pre-conversion contacts captured from /checkup, /book, etc. */
export const leads = pgTable(
  "lead",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    url: text("url"),
    source: leadSource("source").notNull().default("other"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    meta: jsonb("meta"),
    convertedUserId: text("converted_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lead_email_source_idx").on(t.email, t.source),
    index("lead_created_idx").on(t.createdAt),
  ]
);

/** Holding pen for sign-up details between the /trial or /start form
 *  submission and the Stripe Checkout completion. We don't create
 *  user/client/client_member rows until payment succeeds — abandoning
 *  checkout simply leaves the row to expire (24h) without any orphan
 *  account.
 *
 *  finalizePendingSignup() converts the row into real records on
 *  checkout completion. The webhook calls it as a safety net in case
 *  the user closes the browser before the /welcome callback runs. */
export const pendingSignups = pgTable(
  "pending_signup",
  {
    /** Random opaque token, also stored in Stripe metadata as the
     *  bridge between Checkout and our DB. */
    token: text("token").primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Encrypted plaintext password — used ONCE at /welcome to
     *  auto-sign-in the user after they pay. Cleared on finalize.
     *  Encryption key is derived from AUTH_SECRET via SHA-256 (see
     *  `lib/auto-signin-crypto.ts`). Format
     *  `v1:<iv-b64>:<ciphertext-b64>`. Without this, the user would
     *  have to retype their password on /welcome — bad UX. */
    autoSigninPassword: text("auto_signin_password"),
    userName: text("user_name").notNull(),
    businessName: text("business_name").notNull(),
    websiteUrl: text("website_url").notNull(),
    plan: text("plan").notNull(),
    signupSource: text("signup_source").notNull(),
    referredByCode: text("referred_by_code"),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("pending_signup_email_idx").on(t.email),
    index("pending_signup_expires_idx").on(t.expiresAt),
  ]
);

/** In-app notification inbox per user. Email/SMS delivery is a separate
 *  layer driven by `notification_preference`. */
export const notifications = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Event key — matches notification_preference.event_key. e.g.
     *  "request.message_received", "request.status_changed",
     *  "request.urgent_received" (staff). */
    eventKey: text("event_key").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Where clicking the notification should take the user. Path-only;
     *  the proxy resolves it to the right subdomain at click time. */
    href: text("href"),
    /** Loose link to a domain object so we can revalidate when it changes. */
    targetType: text("target_type"),
    targetId: text("target_id"),
    readAt: timestamp("read_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("notif_user_unread_idx").on(t.userId, t.readAt),
    index("notif_user_created_idx").on(t.userId, t.createdAt),
    index("notif_event_idx").on(t.eventKey),
  ]
);

/** Per-user preferences for which channel each event uses. Cascades from
 *  defaults defined in `src/server/notifications.ts`. */
export const notificationPreferences = pgTable(
  "notification_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(true),
    sms: boolean("sms").notNull().default(false),
    /** 'immediate' | 'hourly' | 'daily' | 'off' — kept as text to allow
     *  future values without migration. */
    digest: text("digest").notNull().default("immediate"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventKey] })]
);

/** Periodic uptime / health check result per client site. Append-only;
 *  cleanup of old rows is a future maintenance task (Phase 6 polish). */
export const healthChecks = pgTable(
  "health_check",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    ok: boolean("ok").notNull(),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    error: text("error"),
    checkedAt: timestamp("checked_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("health_client_time_idx").on(t.clientId, t.checkedAt),
    index("health_ok_idx").on(t.ok, t.checkedAt),
  ]
);

/** Diagnostic-tool reports — useful for follow-up emails and trend graphs. */
export const scans = pgTable(
  "scan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    leadId: text("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    clientId: text("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    url: text("url").notNull(),
    finalUrl: text("final_url").notNull(),
    overallScore: integer("overall_score").notNull(),
    overallGrade: text("overall_grade").notNull(),
    report: jsonb("report").notNull(),
    scannedAt: timestamp("scanned_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("scan_client_idx").on(t.clientId),
    index("scan_lead_idx").on(t.leadId),
    index("scan_scanned_idx").on(t.scannedAt),
  ]
);

/* ──────────────────────────────────────────────────────────────────────────
   Relations (Drizzle Query Builder)
   ──────────────────────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  clientMemberships: many(clientMembers),
  submittedRequests: many(requests, { relationName: "submitter" }),
  assignedRequests: many(requests, { relationName: "assignee" }),
  messages: many(messages),
}));

export const clientsRelations = relations(clients, ({ many, one }) => ({
  members: many(clientMembers),
  requests: many(requests),
  primaryUser: one(users, {
    fields: [clients.primaryUserId],
    references: [users.id],
    relationName: "primary",
  }),
  leadDoctor: one(users, {
    fields: [clients.leadDoctorId],
    references: [users.id],
    relationName: "lead_doctor",
  }),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  client: one(clients, { fields: [requests.clientId], references: [clients.id] }),
  submittedBy: one(users, {
    fields: [requests.submittedByUserId],
    references: [users.id],
    relationName: "submitter",
  }),
  assignedDoctor: one(users, {
    fields: [requests.assignedDoctorId],
    references: [users.id],
    relationName: "assignee",
  }),
  messages: many(messages),
  files: many(files),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  request: one(requests, { fields: [messages.requestId], references: [requests.id] }),
  author: one(users, { fields: [messages.authorUserId], references: [users.id] }),
}));

/** Re-export for convenience. */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Request = typeof requests.$inferSelect;
export type NewRequest = typeof requests.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type HealthCheck = typeof healthChecks.$inferSelect;
export type NewHealthCheck = typeof healthChecks.$inferInsert;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type NewMonthlyReport = typeof monthlyReports.$inferInsert;
export type ClientBackup = typeof clientBackups.$inferSelect;
export type NewClientBackup = typeof clientBackups.$inferInsert;
export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type CredentialRequest = typeof credentialRequests.$inferSelect;
export type NewCredentialRequest = typeof credentialRequests.$inferInsert;

// Suppress unused-import warning for `sql` (kept for future migration helpers).
void sql;
