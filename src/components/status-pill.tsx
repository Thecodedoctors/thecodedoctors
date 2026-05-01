import { cn } from "@/lib/cn";

type Status =
  | "triaged"
  | "diagnosed"
  | "in_treatment"
  | "in_review"
  | "healed"
  | "closed";

/**
 * Status labels per PORTAL-SPEC.md voice rule. The DB enum keeps the
 * medical names (so we can roll back to medical labels later without a
 * migration); the patient-visible UI uses plain action language.
 */
const STATUS: Record<
  Status,
  { label: string; tone: string }
> = {
  triaged: {
    label: "New",
    tone: "bg-muted/10 text-muted ring-muted/20",
  },
  diagnosed: {
    label: "Reviewed",
    tone: "bg-accent-soft text-accent ring-accent/30",
  },
  in_treatment: {
    label: "In progress",
    tone: "bg-warning/10 text-warning ring-warning/30",
  },
  in_review: {
    label: "Awaiting your approval",
    tone: "bg-accent-soft text-accent ring-accent/30",
  },
  healed: {
    label: "Resolved",
    tone: "bg-success/10 text-success ring-success/30",
  },
  closed: {
    label: "Closed",
    tone: "bg-muted/10 text-muted ring-muted/20",
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: Status | string;
  className?: string;
}) {
  const meta =
    STATUS[status as Status] ?? {
      label: status,
      tone: "bg-muted/10 text-muted ring-muted/20",
    };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-[0.14em] ring-1 ring-inset",
        meta.tone,
        className
      )}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      {meta.label}
    </span>
  );
}

type Priority = "low" | "medium" | "high" | "urgent";

const PRIORITY: Record<Priority, { label: string; tone: string }> = {
  low: {
    label: "Low",
    tone: "bg-muted/10 text-muted ring-muted/20",
  },
  medium: {
    label: "Medium",
    tone: "bg-foreground/5 text-foreground ring-border-strong",
  },
  high: {
    label: "High",
    tone: "bg-warning/10 text-warning ring-warning/30",
  },
  urgent: {
    label: "Urgent",
    tone: "bg-signal/10 text-signal ring-signal/30",
  },
};

export function PriorityPill({
  priority,
  className,
}: {
  priority: Priority | string;
  className?: string;
}) {
  const meta =
    PRIORITY[priority as Priority] ?? {
      label: priority,
      tone: "bg-muted/10 text-muted ring-muted/20",
    };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono uppercase tracking-[0.14em] ring-1 ring-inset",
        meta.tone,
        className
      )}
    >
      {meta.label}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  improvement: "Improvement",
  security: "Security",
  seo: "SEO",
  performance: "Performance",
  redesign: "Redesign",
  other: "Other",
};

export function TypeLabel({ type }: { type: string }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export const STATUS_ORDER: Status[] = [
  "triaged",
  "diagnosed",
  "in_treatment",
  "in_review",
  "healed",
  "closed",
];

export function statusLabel(status: string): string {
  return (STATUS[status as Status] ?? { label: status }).label;
}
