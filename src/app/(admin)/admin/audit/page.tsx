import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { Section } from "@/components/ui/section";
import { listAuditLogForStaff, type AuditEntry } from "@/server/audit";
import { formatRelativeAgo, formatAbsolute } from "@/lib/time";

export const metadata: Metadata = {
  title: "Audit log · Practice",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ page?: string }>;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const { entries, total, totalPages } = await listAuditLogForStaff({ page });

  return (
    <Section size="md" reveal={false}>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-signal">
          Audit log
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          {total === 0
            ? "Nothing logged yet"
            : `${total} event${total === 1 ? "" : "s"}`}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Append-only history of every staff and patient action that
          modifies the platform. Useful for investigating regressions and
          for the compliance trail.
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-muted ring-1 ring-inset ring-border">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm text-muted">
            No audited actions yet. Status changes, archives, approvals,
            and password changes will appear here as they happen.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-surface/40">
          {entries.map((e) => (
            <AuditRow key={e.id} entry={e} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} />
      )}
    </Section>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actor =
    entry.actorName ?? entry.actorEmail ?? "(deleted user)";
  const linkable = linkForTarget(entry.targetType, entry.targetId);
  const diff = formatDiff(entry.before, entry.after);

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-foreground font-medium">{actor}</span>
            <span className="text-sm text-muted">
              {actionLabel(entry.action)}
            </span>
            {linkable && (
              <Link
                href={linkable}
                className="inline-flex items-center gap-1 font-mono text-xs text-muted underline decoration-border-strong underline-offset-4 hover:decoration-accent"
              >
                {entry.targetType}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {diff && (
            <p className="mt-1.5 font-mono text-xs text-muted">{diff}</p>
          )}
          {entry.ip && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70">
              From {entry.ip}
            </p>
          )}
        </div>
        <time
          className="font-mono text-xs text-muted"
          title={formatAbsolute(entry.ts)}
        >
          {formatRelativeAgo(entry.ts)}
        </time>
      </div>
    </li>
  );
}

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const prev = page > 1 ? `/audit?page=${page - 1}` : null;
  const next = page < totalPages ? `/audit?page=${page + 1}` : null;
  return (
    <nav
      aria-label="Audit log pagination"
      className="mt-6 flex items-center justify-between"
    >
      {prev ? (
        <Link
          href={prev}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          <ChevronLeft className="h-3 w-3" />
          Newer
        </Link>
      ) : (
        <span />
      )}
      <p className="font-mono text-xs text-muted">
        Page {page} of {totalPages}
      </p>
      {next ? (
        <Link
          href={next}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          Older
          <ChevronRight className="h-3 w-3" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case "request.update_status":
      return "changed request status";
    case "request.approved":
      return "approved a request";
    case "request.assign_self":
      return "assigned a request to themselves";
    case "request.archive":
      return "archived a request";
    case "request.unarchive":
      return "restored an archived request";
    case "message.add_staff":
      return "replied to a request";
    case "message.add_client":
      return "replied to a request";
    case "message.add_internal":
      return "added an internal note";
    case "user.password_changed":
      return "changed their password";
    default:
      return action.replace(/[._]/g, " ");
  }
}

function linkForTarget(type: string, id: string | null): string | null {
  if (!id) return null;
  if (type === "request") return `/requests/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
}

function formatDiff(before: unknown, after: unknown): string | null {
  if (!before && !after) return null;
  // Compare flat objects by key
  if (
    typeof before === "object" &&
    typeof after === "object" &&
    before !== null &&
    after !== null
  ) {
    const keys = new Set<string>([
      ...Object.keys(before as object),
      ...Object.keys(after as object),
    ]);
    const parts: string[] = [];
    for (const k of keys) {
      const b = (before as Record<string, unknown>)[k];
      const a = (after as Record<string, unknown>)[k];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        parts.push(`${k}: ${stringify(b)} → ${stringify(a)}`);
      }
    }
    if (parts.length === 0) return null;
    return parts.join(" · ");
  }
  if (after) return `→ ${stringify(after)}`;
  return null;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}
