import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

/**
 * Drizzle client backed by Neon's HTTP-over-Postgres driver.
 *
 * We use neon-http (not raw postgres.js) because Cloudflare Workers don't
 * reliably support raw TCP connections — postgres.js connections silently
 * hang inside Worker isolates. Neon's serverless driver speaks Postgres
 * over HTTPS, which works perfectly on Workers.
 *
 * Trade-off: neon-http doesn't support multi-statement transactions. For
 * our app, that's fine — Auth.js needs none, and our domain mutations
 * are single-statement inserts/updates. Switch to neon-serverless (over
 * WebSocket) if we ever need transactions in a Workers context.
 */
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
  const client = neon(url);
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export { schema };
export * from "./schema";
