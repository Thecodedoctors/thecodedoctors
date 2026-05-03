"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { markNotificationReadById } from "@/server/notifications";

/**
 * Notification row link. Navigates to the target and (for unread items)
 * fires off a "mark read" server action in the background. Lives in a
 * Client Component so we can attach the onClick handler and call the
 * server action via a transition — Server Components can't pass event
 * handlers into DOM elements (React 19+).
 */
export function NotificationLink({
  id,
  href,
  unread,
  children,
}: {
  id: string;
  href: string;
  unread: boolean;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  if (!unread) return <Link href={href}>{children}</Link>;

  return (
    <Link
      href={href}
      onClick={() => {
        startTransition(() => {
          // Fire-and-forget — navigation runs in parallel.
          void markNotificationReadById(id);
        });
      }}
    >
      {children}
    </Link>
  );
}
