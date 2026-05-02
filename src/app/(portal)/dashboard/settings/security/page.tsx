import type { Metadata } from "next";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SecurityForm } from "@/components/settings/security-form";

export const metadata: Metadata = {
  title: "Security · Settings",
  robots: { index: false, follow: false },
};

export default async function ClientSecuritySettingsPage() {
  const session = await requireUser();
  const rows = await db()
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const hasPassword = Boolean(rows[0]?.passwordHash);

  return (
    <SettingsShell
      current="security"
      basePath="/settings"
      accent="accent"
      title="Security"
      description="Change your password. Two-factor authentication arrives in Phase 5."
    >
      <SecurityForm hasPassword={hasPassword} />
    </SettingsShell>
  );
}
