import type { Metadata } from "next";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = {
  title: "Profile · Practice settings",
  robots: { index: false, follow: false },
};

export default async function AdminProfileSettingsPage() {
  const session = await requireStaff();
  const rows = await db()
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const me = rows[0];

  return (
    <SettingsShell
      current="profile"
      basePath="/settings"
      accent="signal"
      title="Profile"
      description="Your doctor identity. Patients see your name on every reply."
    >
      <ProfileForm
        defaultName={me?.name ?? ""}
        email={me?.email ?? session.user.email ?? ""}
      />
    </SettingsShell>
  );
}
