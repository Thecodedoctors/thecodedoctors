import { Button } from "@/components/ui/button";
import { updateEmailPreferences } from "@/server/settings";
import type { NotifyEventDef } from "@/lib/notification-events";

export function NotificationsForm({
  events,
  current,
  accent,
}: {
  events: NotifyEventDef[];
  /** Effective email setting per event key (default applied). */
  current: Record<string, boolean>;
  accent: "accent" | "signal";
}) {
  const accentColor = accent === "accent" ? "accent-accent" : "accent-signal";

  return (
    <form action={updateEmailPreferences} className="space-y-2">
      <p className="text-sm text-muted">
        Choose which events trigger an email. In-app notifications are always
        on — these toggles only affect the email channel.
      </p>

      <ul className="mt-4 divide-y divide-border rounded-2xl border border-border bg-surface/30">
        {events.map((e) => {
          const enabled = current[e.key] ?? e.defaultEmail;
          return (
            <li
              key={e.key}
              className="flex flex-wrap items-start justify-between gap-4 p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{e.label}</p>
                <p className="mt-1 text-xs text-muted">{e.description}</p>
              </div>
              <label className="inline-flex shrink-0 items-center gap-2 text-xs text-muted">
                <input type="hidden" name="event" value={e.key} />
                <input
                  type="checkbox"
                  name={`email:${e.key}`}
                  defaultChecked={enabled}
                  className={`h-4 w-4 rounded border-border-strong bg-background ${accentColor}`}
                />
                Email me
              </label>
            </li>
          );
        })}
      </ul>

      <div className="pt-4">
        <Button type="submit" variant="primary" size="sm">
          Save preferences
        </Button>
      </div>
    </form>
  );
}
