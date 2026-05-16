"use server";

import { AuthError } from "next-auth";
import { sql } from "drizzle-orm";
import { signIn } from "@/auth";
import { db, users, isDbConfigured } from "@/db";
import { sanitizeNext } from "@/lib/safe-next";

/**
 * Two-phase credentials login action, driven by the client
 * <LoginForm/> via useActionState.
 *
 *   phase "credentials" → user submits email + password
 *   phase "totp"        → 2FA account: user submits the 6-digit code
 *                         (email + password ride along in hidden
 *                         fields held in the form's React state, so
 *                         the user NEVER retypes them and the page
 *                         never reloads)
 *
 * On success `signIn` throws a Next redirect which we let propagate —
 * the browser navigates to the portal. Every other outcome returns a
 * `LoginState` the client renders in place.
 *
 * The Credentials provider re-verifies the password on the second
 * (code) submit — unavoidable without a separate pending-MFA token —
 * but that's invisible to the user; the password is only ever held in
 * the form's memory for the few seconds between the two steps.
 */
export type LoginState = {
  phase: "credentials" | "totp";
  /** errorCopy() code the client maps to a message. */
  error?: string;
};

export async function loginAction(
  prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const totpCode = String(formData.get("totpCode") ?? "").trim();
  const next = sanitizeNext(formData.get("next"));

  if (!email) return { phase: "credentials", error: "MissingEmail" };
  if (password.length < 8)
    return { phase: "credentials", error: "ShortPassword" };

  // Pre-check suspended / deleted so the user gets accurate copy
  // instead of a generic "wrong password". (Rate limiting lives in
  // authorize() so it covers the direct callback hit too.)
  if (isDbConfigured()) {
    try {
      const rows = await db()
        .select({
          suspendedAt: users.suspendedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      const u = rows[0];
      if (u?.deletedAt) return { phase: "credentials", error: "Deleted" };
      if (u?.suspendedAt) return { phase: "credentials", error: "Suspended" };
    } catch {
      /* fall through — don't block login on a precheck DB blip */
    }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      totpCode,
      redirectTo: next,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      const code =
        (err as { code?: string }).code ??
        ((err as { cause?: { err?: { code?: string } } }).cause?.err
          ?.code ??
          "");
      if (code === "TotpRequired") return { phase: "totp" };
      if (code === "TotpInvalid")
        return { phase: "totp", error: "TotpInvalid" };
      if (code === "RateLimited")
        // Keep them on whichever step they were on.
        return { phase: prev.phase, error: "RateLimited" };
      return { phase: "credentials", error: "Credentials" };
    }
    // signIn() success throws a Next redirect — MUST propagate.
    const digest = (err as { digest?: unknown })?.digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    // Anything else (e.g. a cold-DB error inside authorize()) would
    // otherwise hit the global Critical page. Degrade to a banner.
    console.error("[login] unexpected sign-in error", err);
    return { phase: "credentials", error: "Credentials" };
  }

  // Unreachable: signIn throws (redirect on success, AuthError on
  // failure). Return a safe default so the type checker is satisfied.
  return { phase: prev.phase };
}
