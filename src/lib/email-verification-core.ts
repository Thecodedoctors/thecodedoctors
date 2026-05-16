/**
 * Email-verification helpers that are NOT server actions — safe to call
 * from a Server Component render path. The /verify-email magic-link
 * route calls `verifyEmailWithToken` directly and then redirects, which
 * doesn't work reliably when the helper lives inside a `"use server"`
 * module because Next's action-call wrapping confuses the subsequent
 * redirect's response framing.
 *
 * The form-action variants (entering a code, resending) still live in
 * `src/server/email-verification.ts` since those are mutations
 * triggered by `<form action={...}>` and need to be server actions.
 */

import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { recordAudit } from "@/server/audit";

const CODE_TTL_HOURS = 24;

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Magic-link variant — token comes from the URL query. No body, the
 * /verify-email page just calls this and renders the result. No
 * session required since the token itself is unguessable proof.
 */
export async function verifyEmailWithToken(
  token: string
): Promise<VerifyResult> {
  if (!token || token.length < 24 || token.length > 64) {
    return { ok: false, error: "Invalid verification link." };
  }

  // DB I/O wrapped: this runs in the /verify-email Server Component
  // render path. An uncaught throw there (Neon cold start / blip)
  // would hit the global Critical page for a paying customer who just
  // clicked their verification email. Degrade to a retry message.
  try {
    const rows = await db()
      .select({
        id: users.id,
        sentAt: users.emailVerificationSentAt,
        verifiedAt: users.emailVerified,
      })
      .from(users)
      .where(eq(users.emailVerificationToken, token))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return {
        ok: false,
        error:
          "This verification link doesn't match any account — it may have been replaced by a newer one.",
      };
    }
    if (row.verifiedAt) {
      return { ok: true };
    }
    if (
      !row.sentAt ||
      Date.now() - row.sentAt.getTime() > CODE_TTL_HOURS * 60 * 60 * 1000
    ) {
      return {
        ok: false,
        error:
          "This verification link expired. Request a fresh one from your dashboard.",
      };
    }

    await db()
      .update(users)
      .set({
        emailVerified: new Date(),
        emailVerificationCodeHash: null,
        emailVerificationToken: null,
        emailVerificationSentAt: null,
        emailVerificationAttempts: 0,
      })
      .where(eq(users.id, row.id));

    await recordAudit({
      actorUserId: row.id,
      action: "user.email_verified",
      targetType: "user",
      targetId: row.id,
    });
  } catch (err) {
    console.error("[verify-email] token verification db error", err);
    return {
      ok: false,
      error: "We couldn't verify the link just now. Try again in a moment.",
    };
  }

  // Intentionally no revalidatePath() here — calling it from this
  // module's render-path context tripped Next 16's response framing
  // and turned the post-verification redirect into a 500. The
  // /dashboard layout fetches the user row fresh on every request
  // anyway, so cache-revalidation isn't load-bearing.

  return { ok: true };
}
