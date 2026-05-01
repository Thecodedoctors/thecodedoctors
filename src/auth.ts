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

export const { handlers, signIn, signOut, auth } = NextAuth({
  // The adapter cast keeps NextAuth happy when DB is not configured at build
  // time — it only resolves the adapter on the first auth call.
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

  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
        // Hydrate role + 2FA status from the user row (added via custom columns).
        const u = user as typeof user & {
          role?: "client" | "doctor" | "senior_doctor" | "founder" | "readonly";
          twoFactorRequired?: boolean;
          totpEnabled?: boolean;
        };
        session.user.role = u.role ?? "client";
        session.user.twoFactorRequired = Boolean(u.twoFactorRequired) || STAFF_ROLES.has(session.user.role);
        session.user.totpEnabled = Boolean(u.totpEnabled);
      }
      return session;
    },
  },

  trustHost: true,
});
