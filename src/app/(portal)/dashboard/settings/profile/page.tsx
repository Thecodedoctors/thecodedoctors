import type { Metadata } from "next";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = {
  title: "Profile · Settings",
  robots: { index: false, follow: false },
};

export default async function ClientProfileSettingsPage() {
  const session = await requireUser();
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
      accent="accent"
      title="Profile"
      description="The basics. Your email is locked to the one you signed in with."
    >
      <ProfileForm
        defaultName={me?.name ?? ""}
        email={me?.email ?? session.user.email ?? ""}
      />
    </SettingsShell>
  );
}
