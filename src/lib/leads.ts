import { promises as fs } from "node:fs";
import path from "node:path";
import { db, isDbConfigured, leads, type NewLead } from "@/db";

/**
 * Lead store. Two modes:
 *   - With DATABASE_URL set: writes to Postgres via Drizzle.
 *   - Without: appends a JSONL line to `data/leads.jsonl` (gitignored).
 *
 * The signature is async + idempotent so the API route never has to care which
 * backend is active.
 */

export type LeadInput = {
  email: string;
  url?: string;
  source: "checkup" | "book" | "newsletter" | "other";
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
};

const FILE_PATH = path.join(process.cwd(), "data", "leads.jsonl");

export async function recordLead(lead: LeadInput): Promise<void> {
  if (isDbConfigured()) {
    try {
      const row: NewLead = {
        email: lead.email,
        url: lead.url,
        source: lead.source,
        ip: lead.ip,
        userAgent: lead.userAgent,
        meta: lead.meta,
      };
      // ON CONFLICT DO NOTHING — same (email, source) shouldn't produce dupes.
      await db().insert(leads).values(row).onConflictDoNothing();
      return;
    } catch (err) {
      console.error("[leads] db insert failed, falling back to file", err);
      // fall through to file
    }
  }

  const stamped = { ...lead, createdAt: new Date().toISOString() };
  try {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.appendFile(FILE_PATH, JSON.stringify(stamped) + "\n", "utf8");
  } catch (err) {
    console.error("[leads] failed to persist", err, stamped);
  }
}
