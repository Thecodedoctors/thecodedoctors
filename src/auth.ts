import NextAuth, { type DefaultSession } from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema, isDbConfigured } from "@/db";
import { site } from "@/lib/site";

/**
 * Auth.js v5 wired to Drizzle + Resend magic links.
 *
 * Roles: `client | doctor | senior_doctor | founder | readonly`.
 * Staff roles (non-`client`) require 2FA; the TOTP gate is enforced in
 * middleware/page-level `auth()` checks (Phase 5 wires the 2FA flow UI).
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

  session: { strategy: "database" },

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY ?? "missing-resend-api-key",
      from: `The Code Doctors <${site.emails.general}>`,
    }),
  ],

  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
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
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        const u = user as typeof user & {
          role?: "client" | "doctor" | "senior_doctor" | "founder" | "readonly";
          twoFactorRequired?: boolean;
          totpEnabled?: boolean;
        };
        session.user.role = u.role ?? "client";
        session.user.twoFactorRequired =
          Boolean(u.twoFactorRequired) || STAFF_ROLES.has(session.user.role);
        session.user.totpEnabled = Boolean(u.totpEnabled);
      }
      return session;
    },
    /**
     * Post-sign-in redirect: route role-aware to the right subdomain.
     * Auth.js calls this after a successful sign-in, with `url` set to the
     * `redirectTo` the caller passed to signIn(). We strip `/dashboard` and
     * `/admin` prefixes since they live on subdomains now, then rewrite to
     * the appropriate origin in production.
     */
    async redirect({ url, baseUrl }) {
      try {
        const target = new URL(url, baseUrl);
        // Allow same-host redirects untouched.
        if (target.origin !== baseUrl) {
          // Only allow our own sub/apex domains for safety.
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

        // In production, route /dashboard/* and /admin/* paths to subdomains.
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
