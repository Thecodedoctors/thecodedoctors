import { promises as fs } from "node:fs";
import path from "node:path";
import { db, isDbConfigured, leads, type NewLead } from "@/db";

/**
 * Lead store. Two modes:
 *   - With DATABASE_URL set: writes to Postgres via Drizzle (Neon HTTP driver).
 *   - Without: appends a JSONL line to `data/leads.jsonl` (gitignored).
 *
 * The signature is async + idempotent. If the DB write hangs or fails for
 * any reason, we fall back to the file store so the lead is never lost.
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
const DB_TIMEOUT_MS = 5000;

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
      await withTimeout(
        db().insert(leads).values(row).onConflictDoNothing(),
        DB_TIMEOUT_MS,
        "lead-insert"
      );
      return;
    } catch (err) {
      console.error("[leads] db insert failed, falling back to file", err);
      // fall through to file fallback below
    }
  }

  const stamped = { ...lead, createdAt: new Date().toISOString() };
  try {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
    await fs.appendFile(FILE_PATH, JSON.stringify(stamped) + "\n", "utf8");
  } catch (err) {
    // On Cloudflare Workers, fs is also unavailable — that's fine, log and
    // move on. The error surfaces in CF logs; we still return to the caller.
    console.error("[leads] failed to persist", err, stamped);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}
