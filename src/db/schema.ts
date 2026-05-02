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
  twoFactorRequired: boolean("two_factor_required").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
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

export const requests = pgTable(
  "request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    submittedByUserId: text("submitted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
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
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
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
    uploaderUserId: text("uploader_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
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

// Suppress unused-import warning for `sql` (kept for future migration helpers).
void sql;
