import Link from "next/link";
import {
  FilePlus,
  MessageCircle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeAgo } from "@/lib/time";
import type { ActivityItem } from "@/server/activity";

const ICONS: Record<ActivityItem["kind"], React.ComponentType<{ className?: string }>> = {
  request_created: FilePlus,
  message_received: MessageCircle,
  message_sent: ArrowRight,
  status_changed: AlertCircle,
};

const TONES: Record<ActivityItem["kind"], string> = {
  request_created: "text-accent bg-accent-soft ring-accent/20",
  message_received: "text-accent bg-accent-soft ring-accent/20",
  message_sent: "text-muted bg-surface ring-border-strong",
  status_changed: "text-warning bg-warning/10 ring-warning/30",
};

const HREF_PREFIX = {
  client: "/requests",
  admin: "/requests",
} as const;

export function ActivityFeed({
  items,
  variant = "client",
  emptyText = "No activity yet — submit your first request to get started.",
}: {
  items: Array<ActivityItem & { clientName?: string | null }>;
  variant?: "client" | "admin";
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface/30 p-8 text-center text-sm text-muted">
        {emptyText}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => {
        const Icon = ICONS[item.kind];
        const tone = TONES[item.kind];
        return (
          <li key={item.id}>
            <Link
              href={`${HREF_PREFIX[variant]}/${item.requestId}`}
              className="block rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:bg-surface/80 hover:border-border-strong"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ring-1 ring-inset",
                    tone
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <ActivityHeadline item={item} />
                  </p>
                  {item.body && (
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.body}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
                    {formatRelativeAgo(item.ts)}
                    {item.clientName && (
                      <>
                        <span className="mx-1.5">·</span>
                        {item.clientName}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityHeadline({
  item,
}: {
  item: ActivityItem & { clientName?: string | null };
}) {
  switch (item.kind) {
    case "request_created":
      return (
        <span>
          <span className="text-foreground">New request</span>
          <span className="text-muted"> · </span>
          <span className="text-foreground">{item.requestTitle}</span>
        </span>
      );
    case "message_received":
      return (
        <span>
          <span className="text-accent">{item.authorName ?? "Someone"}</span>
          <span className="text-muted"> replied to </span>
          <span className="text-foreground">{item.requestTitle}</span>
        </span>
      );
    case "message_sent":
      return (
        <span>
          <span className="text-foreground">You replied</span>
          <span className="text-muted"> on </span>
          <span className="text-foreground">{item.requestTitle}</span>
        </span>
      );
    case "status_changed":
      return (
        <span>
          <span className="text-warning">Status changed</span>
          <span className="text-muted"> on </span>
          <span className="text-foreground">{item.requestTitle}</span>
        </span>
      );
  }
}

