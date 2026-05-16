"use server";

import { db, users, clients } from "@/db";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";

/**
 * Patient-facing referral code system. Each user has a 7-character
 * shareable code, generated lazily on first view of /dashboard/referrals
 * and persisted on the user row. New sign-ups via /trial?ref=CODE or
 * /start?ref=CODE write the code onto client.referred_by_code so the
 * referrer can see who they brought in.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE_LENGTH = 7;

function generateCode(): string {
  let code = "";
  const random = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[random[i] % CODE_ALPHABET.length];
  }
  return code;
}

export type ReferralRow = {
  clientId: string;
  clientName: string;
  status: string;
  plan: string;
  signupSource: string | null;
  joinedAt: Date;
};

/**
 * Returns the current user's referral code, generating one if missing.
 * Retries on collision (effectively never — 32^7 = 34 billion).
 */
export async function getOrCreateMyReferralCode(): Promise<string> {
  const session = await requireUser();
  const rows = await db()
    .select({ code: users.referralCode })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (rows[0]?.code) return rows[0].code;

  // Generate + persist, retrying ONLY on a genuine unique-constraint
  // collision (Postgres 23505 against user_referral_code_unique). Any
  // other error (DB down, cold start) is NOT a collision — masking it
  // as one wastes 5 retries against a dead DB and hides the real cause,
  // so we rethrow immediately. The (portal) error boundary contains
  // either outcome to a recoverable panel rather than the Critical page.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      await db()
        .update(users)
        .set({ referralCode: code })
        .where(eq(users.id, session.user.id));
      return code;
    } catch (err) {
      const pgCode = (err as { code?: string })?.code;
      const isCollision =
        pgCode === "23505" ||
        /unique|duplicate key/i.test(
          err instanceof Error ? err.message : String(err)
        );
      if (!isCollision) {
        console.error("[referrals] referral-code write failed", err);
        throw err;
      }
      console.error("[referrals] code collision, retrying", err);
    }
  }
  throw new Error("Could not generate a unique referral code.");
}

export async function listMyReferrals(): Promise<ReferralRow[]> {
  const session = await requireUser();
  const codeRows = await db()
    .select({ code: users.referralCode })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const code = codeRows[0]?.code;
  if (!code) return [];

  const rows = await db()
    .select({
      clientId: clients.id,
      clientName: clients.name,
      status: clients.status,
      plan: clients.plan,
      signupSource: clients.signupSource,
      joinedAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.referredByCode, code))
    .orderBy(desc(clients.createdAt));

  return rows.map((r) => ({
    ...r,
    joinedAt: new Date(r.joinedAt),
  }));
}

/**
 * Internal — used by the onboarding actions. Returns the user id behind
 * a referral code (or null if no match). Doesn't require an auth context
 * since it runs during sign-up before the new user is logged in.
 */
export async function findUserByReferralCode(
  code: string
): Promise<{ id: string } | null> {
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z2-9]{7}$/.test(trimmed)) return null;
  const rows = await db()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.referralCode, trimmed))
    .limit(1);
  return rows[0] ?? null;
}

