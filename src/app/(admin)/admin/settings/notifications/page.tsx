import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { listEmailPreferencesForCurrentUser } from "@/server/settings";
import { STAFF_EVENTS } from "@/lib/notification-events";
import { requireStaff } from "@/lib/auth-helpers";

export const metadata: Metadata = {
  title: "Notifications · Practice settings",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsSettingsPage() {
  await requireStaff();
  const current = await listEmailPreferencesForCurrentUser(
    STAFF_EVENTS.map((e) => e.key)
  );

  return (
    <SettingsShell
      current="notifications"
      basePath="/settings"
      accent="signal"
      title="Notifications"
      description="Pick which practice events trigger an email. In-app notifications are always on."
    >
      <NotificationsForm
        events={STAFF_EVENTS}
        current={current}
        accent="signal"
      />
    </SettingsShell>
  );
}
