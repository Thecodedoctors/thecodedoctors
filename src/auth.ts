import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db, schema, isDbConfigured, users } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/password";

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
 * In production we set the cookie Domain to `.thecodedoctors.com` so the same
 * session is recognised on apex + app + admin subdomains. In dev we leave it
 * undefined so localhost cookies behave normally.
 */
const cookieDomain = isProd ? ".thecodedoctors.com" : undefined;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: isDbConfigured()
    ? DrizzleAdapter(db(), {
        usersTable: schema.users,
        accountsTable: schema.accounts,
        sessionsTable: schema.sessions,
        verificationTokensTable: schema.verificationTokens,
      })
    : undefined,

  // Credentials requires JWT — database sessions don't work with it.
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password || password.length < 8) return null;
        if (!isDbConfigured()) return null;

        const rows = await db()
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // First-time sign-in: create the user with the supplied password.
        // Auto-bootstrap is acceptable while interim — see memory note.
        if (rows.length === 0) {
          const hash = await hashPassword(password);
          const inserted = await db()
            .insert(users)
            .values({
              email,
              passwordHash: hash,
              role: "client",
            })
            .returning({
              id: users.id,
              email: users.email,
              role: users.role,
            });
          const u = inserted[0];
          return { id: u.id, email: u.email!, role: u.role };
        }

        const user = rows[0];

        // User exists but has no hash yet (e.g. previously created via the
        // earlier magic-link flow): set the password on this first attempt.
        if (!user.passwordHash) {
          const hash = await hashPassword(password);
          await db()
            .update(users)
            .set({ passwordHash: hash })
            .where(eq(users.id, user.id));
          return { id: user.id, email: user.email!, role: user.role };
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
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

      // Re-pull fresh role + 2fa flags so role changes don't require a
      // re-login. Single indexed lookup per request.
      try {
        const rows = await db()
          .select({
            role: users.role,
            twoFactorRequired: users.twoFactorRequired,
            totpEnabled: users.totpEnabled,
          })
          .from(users)
          .where(eq(users.id, token.id as string))
          .limit(1);
        const fresh = rows[0];
        session.user.role = fresh?.role ?? "client";
        session.user.twoFactorRequired =
          Boolean(fresh?.twoFactorRequired) || STAFF_ROLES.has(session.user.role);
        session.user.totpEnabled = Boolean(fresh?.totpEnabled);
      } catch {
        session.user.role = "client";
        session.user.twoFactorRequired = false;
        session.user.totpEnabled = false;
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
