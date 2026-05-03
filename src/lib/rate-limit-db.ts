/**
 * DB-backed sliding-window rate limit. The in-memory variant in
 * `rate-limit.ts` doesn't work across Cloudflare worker isolates —
 * each cold start gets a fresh map. Persisting the counter row lets
 * every isolate see the same state.
 *
 * Each call:
 *   1. Computes the current window-start (`floor(now / windowMs)`),
 *      forms the key `<scope>:<bucket>:<windowStart>`.
 *   2. Upserts: increment the count, set expiresAt to the window end.
 *   3. Reads the new count back; rejects if it's over the limit.
 *
 * Use sparingly — every hit is a DB round-trip. Reserve for paths
 * where being too liberal hurts more than the latency (login,
 * password-reset, public scanner).
 */

import { db, rateLimitCounters } from "@/db";
import { sql } from "drizzle-orm";

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: Date }
  | { ok: false; retryAfter: number; resetAt: Date };

export async function checkRateLimit({
  scope,
  bucket,
  limit,
  windowSeconds,
}: {
  /** What kind of action — `login`, `checkup`, `lead`, etc. */
  scope: string;
  /** What we're rate-limiting per — typically an email or an IP. */
  bucket: string;
  /** Max hits inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const expiresAt = new Date((windowStart + windowSeconds) * 1000);
  const key = `${scope}:${bucket.toLowerCase()}:${windowStart}`;

  // Upsert + return the resulting count in one round-trip. Postgres
  // `INSERT … ON CONFLICT … DO UPDATE … RETURNING` makes this atomic.
  let count = 0;
  try {
    const rows = await db()
      .insert(rateLimitCounters)
      .values({ key, count: 1, expiresAt })
      .onConflictDoUpdate({
        target: rateLimitCounters.key,
        set: {
          // Note: `excluded.count` always equals 1 (the new value
          // being "inserted"). To reference the EXISTING row's count
          // we use the qualified column expression. Some Drizzle/
          // Postgres adapter combos render `${table.col}` in a way
          // that doesn't survive the ON CONFLICT context — using
          // `sql.raw` with the literal column name sidesteps that
          // ambiguity.
          count: sql.raw(`"rate_limit_counter"."count" + 1`),
        },
      })
      .returning({ count: rateLimitCounters.count });
    count = rows[0]?.count ?? 1;
    // TEMP debug log — remove once rate limit is verified working in
    // production (just observable noise in `wrangler tail`).
    console.log("[rate-limit]", key, "→ count=" + count + " / limit=" + limit, "rows.len=" + rows.length);
  } catch (err) {
    // If the rate-limit table doesn't exist yet (migration pending)
    // or the DB is transiently down, fail OPEN — better to let a
    // request through than to break the whole login surface.
    console.error("[rate-limit] check failed; failing open", err);
    return {
      ok: true,
      remaining: limit - 1,
      resetAt: expiresAt,
    };
  }

  if (count > limit) {
    const retryAfter = Math.ceil((expiresAt.getTime() - now) / 1000);
    return { ok: false, retryAfter, resetAt: expiresAt };
  }
  return { ok: true, remaining: Math.max(0, limit - count), resetAt: expiresAt };
}

/** Helper for the most common pattern: throw if rate-limited so the
 *  caller doesn't have to write the error path. */
export async function enforceRateLimit(args: {
  scope: string;
  bucket: string;
  limit: number;
  windowSeconds: number;
  /** What to throw on hit — defaults to a generic Error. */
  message?: string;
}): Promise<RateLimitResult> {
  const result = await checkRateLimit(args);
  if (!result.ok) {
    throw new RateLimitError(
      args.message ?? "Too many attempts. Try again in a moment.",
      result.retryAfter,
      result.resetAt
    );
  }
  return result;
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public resetAt: Date
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}
