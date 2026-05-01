import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import {
  listNotificationsForCurrentUser,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotifications,
} from "@/server/notifications";
import { Section } from "@/components/ui/section";
import { Button } from "@/components/ui/button";
import { formatRelativeAgo } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Notifications · Practice",
  robots: { index: false, follow: false },
};

export default async function AdminNotificationsPage() {
  const items = await listNotificationsForCurrentUser(50);
  const hasUnread = items.some((n) => n.readAt === null);

  return (
    <Section size="md" reveal={false}>
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
              Notifications
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              {items.length === 0
                ? "Practice is quiet."
                : `${items.length} notification${items.length === 1 ? "" : "s"}`}
            </h1>
          </div>
          {hasUnread && (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="secondary" size="sm">
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all as read
              </Button>
            </form>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-signal/10 text-signal ring-1 ring-inset ring-signal/30">
              <Bell className="h-5 w-5" />
            </span>
            <p className="mt-4 text-base text-foreground">No new alerts.</p>
            <p className="mt-2 text-sm text-muted">
              When patients submit, reply, or approve, you&apos;ll see it here.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "rounded-xl border p-5 transition-colors",
                  n.readAt
                    ? "border-border bg-surface/30"
                    : "border-signal/30 bg-signal/5"
                )}
              >
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.readAt ? "bg-muted/40" : "bg-signal"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-medium text-foreground">
                        {n.href ? (
                          <Link href={n.href}>{n.title}</Link>
                        ) : (
                          n.title
                        )}
                      </h3>
                      <time className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                        {formatRelativeAgo(n.createdAt)}
                      </time>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-sm text-muted line-clamp-3">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!n.readAt && (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          aria-label="Mark read"
                          className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    )}
                    <form action={deleteNotifications}>
                      <input type="hidden" name="id" value={n.id} />
                      <button
                        type="submit"
                        aria-label="Dismiss"
                        className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
