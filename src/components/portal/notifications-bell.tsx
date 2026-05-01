import Link from "next/link";
import { Bell } from "lucide-react";
import { unreadCountForCurrentUser } from "@/server/notifications";

/**
 * The bell icon in the topbar. Server component — fetches the unread count
 * each render. Pretty cheap (a single COUNT query), and Next.js's
 * revalidation invalidates the layout when notifications change.
 */
export async function NotificationsBell({
  variant,
}: {
  variant: "client" | "admin";
}) {
  let count = 0;
  try {
    count = await unreadCountForCurrentUser();
  } catch {
    // Don't blow up the topbar if the DB blip — show a quiet bell.
    count = 0;
  }

  const dotClass =
    variant === "admin"
      ? "bg-signal ring-2 ring-background"
      : "bg-accent ring-2 ring-background";

  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0
          ? `Notifications (${count} unread)`
          : "Notifications"
      }
      className="relative grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <>
          <span
            aria-hidden
            className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${dotClass}`}
          />
          <span className="sr-only">{count} unread</span>
        </>
      )}
    </Link>
  );
}
