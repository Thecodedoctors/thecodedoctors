import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/settings-shell";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { listEmailPreferencesForCurrentUser } from "@/server/settings";
import { CLIENT_EVENTS } from "@/lib/notification-events";

export const metadata: Metadata = {
  title: "Notifications · Settings",
  robots: { index: false, follow: false },
};

export default async function ClientNotificationsSettingsPage() {
  const current = await listEmailPreferencesForCurrentUser(
    CLIENT_EVENTS.map((e) => e.key)
  );

  return (
    <SettingsShell
      current="notifications"
      basePath="/settings"
      accent="accent"
      title="Notifications"
      description="Pick which events email you. We'll always notify you in-app — these toggles only affect email."
    >
      <NotificationsForm
        events={CLIENT_EVENTS}
        current={current}
        accent="accent"
      />
    </SettingsShell>
  );
}
