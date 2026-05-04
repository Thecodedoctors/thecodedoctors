import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { requireClient } from "@/lib/auth-helpers";
import { db, users } from "@/db";

/**
 * Client portal layout. Auth-gated via `requireClient` — that helper
 * also bounces suspended/deleted users to the login page (the raw
 * `auth()` call we used to use here didn't, so a freshly-suspended
 * staff member kept their session until JWT expiry).
 *
 * Two-factor enforcement: only patients explicitly flagged as
 * `twoFactorRequired` (set per-user by an admin via the team page or
 * SQL) get bounced to /settings/security to enroll. The default
 * patient experience has 2FA optional — forcing it on every patient
 * adds enrollment friction at every sign-up that hurts conversion.
 * Staff get blanket enforcement in their own layout.
 *
 * Email verification: every patient page renders a top-of-page banner
 * if `users.emailVerified` is null. Doesn't block anything — just a
 * persistent nudge until they confirm their inbox.
 */
import { AppShell } from "@/components/portal/app-shell";
import { EmailVerificationBanner } from "@/components/portal/email-verification-banner";

export default async function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireClient("/dashboard");
  if (session.user.twoFactorRequired && !session.user.totpEnabled) {
    const h = await headers();
    const path = h.get("x-pathname") ?? "";
    const onSecurityPage =
      path.includes("/settings/security") || path.startsWith("/api/");
    if (!onSecurityPage) {
      redirect("/settings/security?enforce=1");
    }
  }

  // One row read for the banner — pulls only the verified flag.
  const userRow = await db()
    .select({ verifiedAt: users.emailVerified })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const emailVerifiedAt = userRow[0]?.verifiedAt ?? null;

  return (
    <AppShell
      variant="client"
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
      }}
      topBanner={<EmailVerificationBanner verifiedAt={emailVerifiedAt} />}
    >
      {children}
    </AppShell>
  );
}
