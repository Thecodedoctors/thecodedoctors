import { db, clients, clientMembers, requests, type Client } from "@/db";
import { eq, and, sql, isNotNull, desc } from "drizzle-orm";

/**
 * Find the primary client (organization) for a user, or create a default one
 * if none exists. We auto-create on first dashboard load so the user can
 * submit a request without an explicit onboarding step.
 *
 * For users on multiple teams later, this returns the FIRST membership.
 * Multi-org switching can be Phase 3 v2.
 */
export async function getOrCreateClientForUser(
  userId: string,
  hint: { name?: string | null; email?: string | null } = {}
): Promise<Client> {
  // Existing membership?
  const existing = await db()
    .select({ client: clients })
    .from(clientMembers)
    .innerJoin(clients, eq(clients.id, clientMembers.clientId))
    .where(eq(clientMembers.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].client;
  }

  // Create a default client and membership.
  const fallbackName =
    hint.name?.trim() ||
    hint.email?.split("@")[0] ||
    "Patient";
  const inserted = await db()
    .insert(clients)
    .values({
      name: fallbackName,
      primaryUserId: userId,
      plan: "checkup",
      status: "lead",
    })
    .returning();
  const created = inserted[0];

  await db().insert(clientMembers).values({
    clientId: created.id,
    userId,
    isAdmin: true,
  });

  return created;
}

/**
 * Strict lookup — returns null if the user isn't a member of any client.
 */
export async function getClientForUser(userId: string): Promise<Client | null> {
  const rows = await db()
    .select({ client: clients })
    .from(clientMembers)
    .innerJoin(clients, eq(clients.id, clientMembers.clientId))
    .where(eq(clientMembers.userId, userId))
    .limit(1);
  return rows[0]?.client ?? null;
}

/**
 * Distinct site URLs known for this client — apex `client.website_url`
 * plus any URL the patient has previously used on a request.
 *
 * Used by the new-request form to render a dropdown instead of asking
 * for the URL every time. See `project_signup_url_capture` memo.
 */
export async function knownUrlsForClient(clientId: string): Promise<string[]> {
  const set = new Set<string>();

  const c = await db()
    .select({ websiteUrl: clients.websiteUrl })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const apex = c[0]?.websiteUrl?.trim();
  if (apex) set.add(apex);

  const past = await db()
    .select({ url: requests.url })
    .from(requests)
    .where(and(eq(requests.clientId, clientId), isNotNull(requests.url)))
    .orderBy(desc(requests.createdAt))
    .limit(20);
  for (const row of past) {
    if (row.url) set.add(row.url.trim());
  }

  return Array.from(set);
}

/**
 * Returns true if `userId` is a member of `clientId`.
 */
export async function userBelongsToClient(
  userId: string,
  clientId: string
): Promise<boolean> {
  const rows = await db()
    .select({ id: clientMembers.userId })
    .from(clientMembers)
    .where(
      and(
        eq(clientMembers.userId, userId),
        eq(clientMembers.clientId, clientId)
      )
    )
    .limit(1);
  return rows.length > 0;
}

// Suppress unused `sql` import warning (kept for future queries here).
void sql;
