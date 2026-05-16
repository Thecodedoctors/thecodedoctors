import NextAuth, {
  type DefaultSession,
  CredentialsSignin,
} from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq, sql } from "drizzle-orm";
import { db, isDbConfigured, users } from "@/db";
import { verifyPassword } from "@/lib/password";
import { verifyTotpForLogin } from "@/server/two-factor";
import { checkRateLimit } from "@/lib/rate-limit-db";

/**
 * Auth.js v5 wired to Drizzle.
 *
 * INTERIM: email + password (Credentials provider) for development convenience.
 * The production target is Resend magic-link — see memory note
 * `project_auth_credentials_interim.md` for the revert plan.
 *
 * Roles: `client | doctor | senior_doctor | founder | readonly`.
 * Staff roles (non-`client`) require 2FA (enforcement is Phase 5).
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "client" | "doctor" | "senior_doctor" | "founder" | "readonly";
      twoFactorRequired: boolean;
      totpEnabled: boolean;
      /** Re-pulled fresh from the DB on every session() call so an
       *  in-flight suspension or soft-delete kicks the user out on
       *  their next request. */
      suspended: boolean;
      deleted: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    role?: "client" | "doctor" | "senior_doctor" | "founder" | "readonly";
    twoFactorRequired?: boolean;
    totpEnabled?: boolean;
  }
}

const STAFF_ROLES = new Set(["doctor", "senior_doctor", "founder", "readonly"]);

const isProd = process.env.NODE_ENV === "production";

/**
 * Custom credentials-signin error codes the login form reads to
 * surface specific copy ("Enter your authenticator code" vs the
 * generic "wrong password").
 */
class TotpRequiredError extends CredentialsSignin {
  code = "TotpRequired";
}
class TotpInvalidError extends CredentialsSignin {
  code = "TotpInvalid";
}
class RateLimitedError extends CredentialsSignin {
  code = "RateLimited";
}

/** Pull the real client IP from a Cloudflare-fronted request. Falls
 *  back to nothing if the request object isn't available (e.g. tests). */
function clientIpFromRequest(req: Request | undefined): string | null {
  if (!req) return null;
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

/**
 * In production we set the cookie Domain to `.thecodedoctors.com` so the same
 * session is recognised on apex + app + admin subdomains. In dev we leave it
 * undefined so localhost cookies behave normally.
 */
const cookieDomain = isProd ? ".thecodedoctors.com" : undefined;

/**
 * No `adapter:` is configured — we use JWT session strategy (Credentials
 * provider requires it), and authorize() reads/writes the user row by
 * hand. The DrizzleAdapter (~3 MB raw bundle weight) was used only for
 * its database-session table writes which we no longer need.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({

  // Credentials requires JWT — database sessions don't work with it.
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Authenticator code", type: "text" },
      },
      async authorize(creds, request) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        const totpCode = String(creds?.totpCode ?? "");
        if (!email || !password || password.length < 8) return null;
        if (!isDbConfigured()) return null;

        // Rate limit — applies to BOTH the form-action path and the
        // direct /api/auth/callback/credentials hit (which is what an
        // attacker would target). Email-bucket at 10/15min matches
        // SECURITY-POSTURE.md; we also IP-bucket at 50/15min so a
        // distributed credential-stuffing campaign across emails still
        // gets throttled. FAILS CLOSED — if the rate-limit DB errors we
        // deny rather than allow, so a DB outage can't be used to lift
        // brute-force protection on the credential surface.
        const ip = clientIpFromRequest(request);
        const emailLimit = await checkRateLimit({
          scope: "login",
          bucket: email,
          limit: 10,
          windowSeconds: 900,
          failClosed: true,
        });
        if (!emailLimit.ok) throw new RateLimitedError();
        if (ip) {
          const ipLimit = await checkRateLimit({
            scope: "login_ip",
            bucket: ip,
            limit: 50,
            windowSeconds: 900,
            failClosed: true,
          });
          if (!ipLimit.ok) throw new RateLimitedError();
        }

        // Sign-in only — accounts are created via /trial or /start
        // (commitment-driven onboarding). Login does NOT auto-create.
        // Case-insensitive match: `email` is already lowercased above,
        // and a `lower(email)` unique index backs this (see schema).
        // Prevents lockouts/dupes from mixed-case stored addresses.
        const rows = await db()
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1);
        if (rows.length === 0) return null;

        const user = rows[0];
        // Suspended or soft-deleted users can't sign in regardless of
        // password. We return null (same as wrong password) so the
        // sign-in page can't be used to enumerate which accounts are
        // suspended vs which simply don't exist.
        if (user.suspendedAt || user.deletedAt) return null;
        if (!user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // 2FA challenge — required for accounts that have TOTP enabled.
        // We bubble distinct sentinel errors so the login page can
        // show the right copy.
        if (user.totpEnabled) {
          if (!totpCode) {
            throw new TotpRequiredError();
          }
          const totpOk = await verifyTotpForLogin(user.id, totpCode);
          if (!totpOk) {
            throw new TotpInvalidError();
          }
        }

        return { id: user.id, email: user.email!, role: user.role };
      },
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        domain: cookieDomain,
      },
    },
    callbackUrl: {
      name: isProd ? "__Secure-authjs.callback-url" : "authjs.callback-url",
      options: {
        sameSite: "lax",
        secure: isProd,
        path: "/",
        domain: cookieDomain,
      },
    },
    csrfToken: {
      name: isProd ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        // __Host- prefix forbids Domain attribute — leave undefined to comply.
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, copy the user id into the token. Role + 2fa state are
      // re-pulled fresh from the DB on every session() call below so any
      // promotion / role change takes effect immediately without re-login.
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      if (!session.user || !token.id) return session;
      session.user.id = token.id as string;

      // Re-pull fresh role + 2fa + suspension/deletion flags on every
      // request. Without this, an in-flight role change OR an
      // in-flight suspension wouldn't take effect until the JWT
      // expired. The flags are checked by `requireUser` and the
      // portal/admin layouts to bounce the offender out.
      try {
        const rows = await db()
          .select({
            role: users.role,
            twoFactorRequired: users.twoFactorRequired,
            totpEnabled: users.totpEnabled,
            suspendedAt: users.suspendedAt,
            deletedAt: users.deletedAt,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        const fresh = rows[0];
        session.user.role = fresh?.role ?? "client";
        session.user.twoFactorRequired =
          Boolean(fresh?.twoFactorRequired) || STAFF_ROLES.has(session.user.role);
        session.user.totpEnabled = Boolean(fresh?.totpEnabled);
        session.user.suspended = Boolean(fresh?.suspendedAt);
        session.user.deleted = Boolean(fresh?.deletedAt);
      } catch {
        session.user.role = "client";
        session.user.twoFactorRequired = false;
        session.user.totpEnabled = false;
        session.user.suspended = false;
        session.user.deleted = false;
      }
      return session;
    },

    /**
     * Post-sign-in redirect: route role-aware to the right subdomain.
     * Auth.js calls this with `url` set to the `redirectTo` the caller
     * passed to signIn(). We strip `/dashboard` and `/admin` prefixes since
     * they live on subdomains now, then rewrite to the appropriate origin.
     */
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        if (target.origin !== baseUrl) {
          if (
            isProd &&
            (target.host === "thecodedoctors.com" ||
              target.host === "app.thecodedoctors.com" ||
              target.host === "admin.thecodedoctors.com")
          ) {
            return target.toString();
          }
          return baseUrl;
        }

        if (isProd) {
          if (target.pathname === "/dashboard" || target.pathname.startsWith("/dashboard/")) {
            const rest = target.pathname.slice("/dashboard".length) || "/";
            return `https://app.thecodedoctors.com${rest}${target.search}`;
          }
          if (target.pathname === "/admin" || target.pathname.startsWith("/admin/")) {
            const rest = target.pathname.slice("/admin".length) || "/";
            return `https://admin.thecodedoctors.com${rest}${target.search}`;
          }
        }

        return target.toString();
      } catch {
        return baseUrl;
      }
    },
  },

  trustHost: true,
});
