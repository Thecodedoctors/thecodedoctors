import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy-initialised Drizzle client. Calling `db()` requires DATABASE_URL.
 * For surfaces that should work without a database (the marketing site,
 * /api/checkup), avoid calling `db()` and use the file-store fallbacks.
 */
let cachedClient: ReturnType<typeof postgres> | undefined;
let cachedDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): ReturnType<typeof drizzle<typeof schema>> {
  if (cachedDb) return cachedDb;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local — Neon's free tier works."
    );
  }
  // `prepare: false` is required for connection-pooled Postgres (Neon, Supabase).
  cachedClient = postgres(url, { prepare: false });
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

export { schema };
export * from "./schema";
