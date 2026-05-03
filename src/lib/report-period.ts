/**
 * Pure helpers shared between the monthly-report server actions and
 * the page components that render reports. Lives outside `src/server/`
 * because Next.js requires every export from a `"use server"` file
 * to be an async function — sync utilities have to live elsewhere.
 */

export function labelForPeriod(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
