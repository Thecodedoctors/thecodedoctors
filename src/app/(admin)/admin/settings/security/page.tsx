import type { Metadata } from "next";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { SecurityForm } from "@/components/settings/security-form";

export const metadata: Metadata = {
  title: "Security · Practice settings",
  robots: { index: false, follow: false },
};

export default async function AdminSecuritySettingsPage() {
  const session = await requireStaff();
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
      accent="signal"
      title="Security"
      description="Change your password. Mandatory TOTP 2FA for staff lands in Phase 5."
    >
      <SecurityForm hasPassword={hasPassword} />
    </SettingsShell>
  );
}
