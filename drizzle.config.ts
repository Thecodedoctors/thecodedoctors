import { defineConfig } from "drizzle-kit";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Drizzle Kit (push, migrate, generate, studio) needs the DIRECT Postgres
 * connection — not the pooled one — because pgbouncer doesn't support some
 * of the DDL statements Drizzle generates for enums and triggers.
 *
 * Neon shows both URLs in the dashboard. Set:
 *   DATABASE_URL          → pooled (-pooler. in the host) — for the live app
 *   DATABASE_URL_UNPOOLED → direct  (no -pooler.)         — for migrations
 *
 * Drizzle Kit doesn't respect Next.js's `.env.local` convention, so we load it
 * manually here. We also strip `channel_binding=require` because some bundled
 * postgres drivers crash silently on it.
 */
loadEnvFile(".env.local");
loadEnvFile(".env");

const rawUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  "postgres://placeholder";

const url = rawUrl
  .replace(/[?&]channel_binding=\w+/g, "")
  .replace(/\?&/, "?")
  .replace(/[?&]$/, "");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});

function loadEnvFile(path: string) {
  try {
    const content = readFileSync(resolve(path), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, rawVal] = m;
      if (process.env[key]) continue;
      let val = rawVal;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  } catch {
    // file may not exist — fine for production
  }
}
